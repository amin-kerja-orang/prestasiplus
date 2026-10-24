# M21 — Sponsorship & Anak Angkat: admin sponsors, anak angkat assignments, foster-family applications, "Mohon Keluarga Angkat" form, public sponsor registration, sponsor portal — User Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | URS — M21 Sponsorship & Anak Angkat (admin sponsor list, create and edit; admin anak-angkat assignments; admin foster-family applications; "Mohon Keluarga Angkat" application form; public sponsor registration; PROPOSED minimum sponsor portal) |
| Version | 1.2 |
| Date | 2026-09-27 |
| Status | **Approved (G1) — v1.2** (user approval 2026-09-27; decisions OQ-M21-01 and OQ-M21-02 below). No open question blocks the observed scope. The unobservable parts (sponsor portal, sponsor landing page, status actions on pending / approved / rejected sponsors, flash and validation messages, the S7 success outcome, the student-search result limit and which students are searchable, rows in the other statuses, Hadiah, free access, "Via Agent", page sizes) are INFERRED or PROPOSED and listed in §9 OQ-M21-13 (reported at G1). |
| Author | product-analyst (agent). §3 Function catalogue, §6 coverage matrix and §7.1 count reconciliation were compiled from the inventory JSON and the seed snapshot by hand (no script runtime in the writer's session); the check scripts are in the writer's scratchpad `m21-writer/` for the Delivery Lead / auditor to run: `coverage.cjs` and `trace.cjs` (basic) plus, from v1.1, the auditor-strength `cov.cjs`, `strict.cjs` and `trace-strict.cjs` (the latter includes the auditor's `extra.cjs` closure checks) (AUD-M21-07) |
| Source discovery | [M21-sponsorship.md](../../discovery/M21-sponsorship.md) (§1–§11, figures §5.1, seed §5.2, conflicts C1–C8 §5.3, ledger §5.4, defects D-M21-01…11 §8.2, OQ-M21-01…09 §9, Appendices A–B); inventory [`inventory/M21/`](../../discovery/inventory/M21/) (`S1…S7-*.json`, **345** content elements, 55 captured states; `SHA-admin-shell.json` 217, `SHU-user-shell.json` 372; `_crawl.json`; `_summary.md`; seed snapshot `_snapshot-2026-09-27.json` captured **2026-09-27 10:25 MYT**); 32 masked screenshots `docs/discovery/img/M21/` |
| Companion SRS | [srs/M21-sponsorship.md](../srs/M21-sponsorship.md) |
| Related | M01 v1.12 (users base, guest redirect, landing pages BR-07, global 404 / 403, canonical account 7 `penaja@demo.test` "Penaja Demo"), **M02 v1.26** (users dataset: `sponsor` cell 6 with reserved anchors 7 and 5501–5502, parent links, student search), M08 v1.10 ("Jadi Penaja" link), M15 v1.4 (Kedai Hadiah — "Hadiah" count), **M17 v1.11** (provisional sponsor store, now handed over to M21), M19 v1.3 (entitlement; free access not written), M24 ("Via Agent", not yet specified), global shells ([design/shells.md](../../design/shells.md), DV-SH-03), [design/design-system.md](../../design/design-system.md) **v1.9** §6 (icon rows; the three M21 rows of XR-M21-08 are applied) |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-09-27 | First issue under D7 (fidelity), D8 (proven completeness), D9 / D10 (deviation rule, accessibility), D11 (every count from a named query over M21's own stores), D12 (M21 owns sponsors, anak-angkat records and foster-family applications; users are read through M01 / M02; the provisional sponsor store hosted by M17 moves to M21, XR-M21-03), D14 (no external screen; e-mail notices simulated) and the privacy rule (fictitious students, parent, contact officer, sponsor login e-mails and parent-written reasons). **345/345** content elements covered (342 mapped, 3 excluded with reason), 0 unmapped; the 589 shell elements are excluded as global-shell chrome, with the 16 of them that render an M21 menu entry or header title specified by FN-M21-1.1.1–1.1.3. 15 deviation decisions (§7). |
| 1.1 | 2026-09-27 | AUD round 1 fixes (`docs/qa/audit/M21-audit.md`, FAIL: 1 Major, 6 Minor, 4 Nit). **AUD-M21-01 (Major):** the S4 student-search result row is SOURCE-DERIVED from the live Alpine template (nothing typed): name (bold) and "{e-mail}" + " · {school}" when the student has a school; FN-3.1.3, matrix S4-022, AC-12.2, OQ-04 / 13; the 10 px second line joins DV-07; SRS API #9, XR-M21-01 (d), §8.2 carry the school. **AUD-02:** DV-07 lists the actual sub-12 px elements (S7 13 tile labels + 3 step pills + 4 footer texts; S4 sponsor category line and student cell; S5 student-cell lines); FN-1.3.5, 3.1.7, 4.1.2, 5.1.1, 5.1.5 lift them. **AUD-03:** S4 "Saluran" `required` (FN-3.1.4, S4-027); S7 "Poskod" `maxlength=5` (FN-5.1.3, S7-050); S3 status card blue `fa-toggle-on` (FN-2.3.4, S3-046). **AUD-04:** S7 footer order "Sudah ada akaun? Log Masuk · Daftar Sebagai Pelajar" (FN-5.1.5, AC-18.4). **AUD-05:** citations M01 v1.12, M02 v1.26, M08 v1.10, M15 v1.4, M17 v1.11, design-system v1.9. **AUD-06:** "{label} ({code})" for statuses other than SUSPENDED marked INFERRED (DV-08, FN-2.3.4, FN-2.3.6, AC-10.2 / 10.3). **AUD-07:** strengthened scripts. **AUD-08:** new AC-M21-14.4 (badges of unobserved application statuses, FR-45) and AC-M21-22.5 (transition rules, FR-66) so every FR traces to its function's story. **AUD-09:** AC-22.3 second clause tagged provisional. **AUD-10:** FN-5.1.2 EL list starts at S7-008. **AUD-11:** the adopted student's fictitious e-mail is `irfanhakimi@demo.test` (no real government domain). **AUD-12:** DV-06 cites DV-SH-03. Counts: 79 FN, 23 US, **75 AC**; coverage unchanged 345/345. |
| 1.2 | 2026-09-27 | G1 approved by user 2026-09-27 with decisions: sponsor portal minimum (OQ-01), pending-sponsor actions Luluskan/Tolak only (OQ-02). Citations re-checked (M01 v1.12, M02 v1.26, M15 v1.4, M17 v1.11, M19 v1.3, design-system v1.9 current; M04 v1.16, M14 v1.8, M20 v1.2, overview v1.8, build-plan v1.11 noted). D14 confirmed: no external-platform screens; e-mail and WhatsApp hand-offs are simulated or plain links. No observed value, count or AC changed (79 FN, 23 US, 75 AC, coverage 345/345). |

**Conventions** (as M01–M20)
- Quoted UI copy is the exact live text. English or mixed words that live shows ("Assign Anak Angkat", "Assign", "Graduate", "Graduated", "Withdrawn", "Expired", "Active", "Pending", "Direct", "Via Agent", "Anak Angkat — Sponsorship", "Website", "Tagline", applicant roles "parent" / "student", the pager "« Previous" / "Next »" / "Showing 0 of 6 results", the status-card code "(SUSPENDED)") are live copy and are kept (D-M21-10, DV-M21-10).
- **OBSERVED** = seen on live with the admin account (walk-through, inventory state, snapshot, screenshot). **SOURCE-DERIVED** = read from page markup captured read-only while the state never rendered (form actions, `confirm()` texts, Alpine code). **INFERRED** = the most likely live behaviour, not observed; no new UX is invented. **PROPOSED** / **PROPOSED COPY** = a value, layout or text written for the rebuild where live gives nothing; listed in §9 OQ-M21-13 for the Delivery Lead to report at G1.
- **D-M21-n** = live defect of discovery §8.2; **DV-M21-nn** = fidelity deviation (§7), anything not listed there must match live; **SEC-M21-nn** = security / privacy item (SRS §11.1); **XR-M21-nn** = request to another owner (SRS §6.12); **C1–C8** = discovery cross-module conflicts (§5.3).
- **Personal data (privacy overrides fidelity):** the sponsor **companies** ("Kedai Buku Popular", "Faber-Castell Malaysia", "KidZania Kuala Lumpur", "Petrosains Discovery Centre", "PRESTASIPLUS Official", "Alesa It Services") are organisations observed on live and are kept. Every person is replaced by a fictitious anchor (DV-M21-12): the contact officer of #11 **"Hafiz Bin Contoh"** (`pegawai.alesa@demo.test`, `0100000011`); the adopted student **"Irfan Hakimi Bin Contoh"**; the three applicant students **"Nur Hajar Binti Demo"** (self-applied) and the siblings **"Adam Haikal Bin Demo"** and **"Aina Sofea Binti Demo"**; their parent **"Rosnah Binti Demo"**; the sponsor login e-mails `sponsor1@demo.test` … `sponsor5@demo.test` (#6–#10) and canonical account 7 `penaja@demo.test` (#11); the parent-written reason of applications #2 / #3 is a fictitious text. No real name, e-mail, telephone number, address or family circumstance is written anywhere.
- "Admin" = `admin@demo.test` (canonical 1). "Pelajar" = `pelajar@demo.test` (canonical 2). "Ibubapa" = `ibubapa@demo.test` (canonical 6). "Penaja" = `penaja@demo.test` (canonical 7, login of sponsor #11). **Clock:** the single project clock **2026-09-25T15:40:00+08:00**. No M21 figure is time-dependent except "Tarikh" of new records; the 2026-09-27 readings of discovery are the observed record and no M21 page shows a counter (discovery §5.4).

---

## 1. Overview

M21 is the sponsorship programme of PRESTASIPLUS. **Sponsors** (organisations) register themselves on a public page or are added by an administrator; administrators review them. **Families, students and teachers apply** for a student to be sponsored ("Mohon Keluarga Angkat"); an administrator approves the application into a **pool**, from which a sponsor picks the student ("Ditaja"), who then gets free access to PRESTASIPLUS for one school session (S6 copy). Administrators can also **assign** a student to a sponsor directly ("Assign Anak Angkat") and close a sponsorship ("Graduate", "Tarik").

The TRACKER listed 5 M21 routes; the crawl found **7 screens** (2 new routes), 11 write endpoints / POST-only routes (never submitted on live), 1 student-search JSON endpoint (never called) and a role-gated **sponsor portal** (403 for the admin; content not observable).

**Routes covered**

| # | Route | Tab title (exact live) | Shell header (title / subtitle) | Admin outcome (observed) |
|---|---|---|---|---|
| S1 | `/admin/sponsors` (`?search=&status=&category=&page=`) | "Urus Penaja - Admin" | SHA "Pengurusan Penaja" / "Semak dan urus permohonan penaja" | 200; guest → `/login` |
| S2 | `/admin/sponsors/create` (new) | "Tambah Penaja - Admin" | SHA "Tambah Penaja Baru" / "Daftar penaja baru (auto-diluluskan)" | 200 |
| S3 | `/admin/sponsors/{id}/edit` (new) | "Edit Penaja - Admin" | SHA "Edit Penaja" / {organisation name} | 200; unknown id 404; `GET /admin/sponsors/{id}` 500 (→ S3, DV-M21-01) |
| S4 | `/admin/anak-angkat` (`?status=`) | "Pengurusan Anak Angkat" | SHA "Anak Angkat — Sponsorship" / "Selamat datang, Admin" | 200; `GET /admin/anak-angkat/{x}` 405 (→ 404, DV-M21-02) |
| S5 | `/admin/anak-angkat/permohonan` (`?status=`) | "Permohonan Anak Angkat" | SHA "Permohonan Keluarga Angkat" / "Selamat datang, Admin" | 200; `/admin/anak-angkat/permohonan/{id}` 404 |
| S6 | `/mohon-keluarga-angkat` | "Mohon Keluarga Angkat" | SHU "Dashboard" / "Selamat datang kembali" on live (→ "Mohon Keluarga Angkat", DV-M21-06); page H1 "Mohon Keluarga Angkat" | 200; guest → `/login` |
| S7 | `/sponsor/register` | "Daftar Penaja - PRESTASIPLUS" | no shell; H1 "PRESTASIPLUS" / "Pendaftaran Penaja" | 200 for admin and guest |

**Write endpoints (never submitted on live; specified from the markup):** `POST /admin/sponsors` (S2), `PUT /admin/sponsors/{id}` (S3), `POST /admin/sponsors/{id}/reactivate` (S3), `POST /admin/anak-angkat/assign` (S4), `POST /admin/anak-angkat/{id}/status` (S4), `POST /admin/anak-angkat/permohonan/{id}/lulus` and `/tolak` (S5), `POST /mohon-keluarga-angkat` (S6), `POST /sponsor/register` (S7); JSON `GET /admin/anak-angkat/cari-pelajar?q=` (S4, never called).

**Role-gated sponsor portal (403 "Akses Ditolak" for the admin; content not observable):** `/sponsor`, `/sponsor/anak-angkat`, `/sponsor/anak-angkat/pool`, `/sponsor/rewards`; POST-only `/sponsor/profile` (GET 405 → 404, DV-M21-02). The rebuild specifies only the **PROPOSED minimum** needed for the application → pool → sponsorship flow to work end to end (EP-M21-6).

Probed and not found (global 404, replicated): `/admin/sponsors/999999`, `/admin/sponsors/999999/edit`, `/admin/sponsor`, `/admin/penaja`, `/admin/sponsors/applications`, `/admin/anak-angkat/permohonan/1`, `/sponsor/dashboard`, `/sponsor/login`, `/sponsor/pool`, `/sponsor/pelajar`, `/sponsor/hadiah`, `/sponsor/laporan`, `/sponsor/reports`, `/sponsor/students`, `/sponsor/status`, `/sponsor/pending`, `/sponsor/menunggu`, `/sponsor/profil`, `/sponsor/tetapan`, `/sponsor/settings`, `/sponsor/register/success`, `/sponsor/berjaya`, `/sponsor/home`, `/sponsor/index`, `/sponsor/campaigns`, `/sponsor/kempen`, `/sponsor/sumbangan`, `/sponsor/invoices`, `/sponsor/1`, `/penaja`, `/penaja/dashboard`, `/anak-angkat`, `/keluarga-angkat`, `/keluarga-angkat/dashboard`, `/mohon-keluarga-angkat/status`.

**Cross-module ownership.** M21 owns (D12) the stores **Sponsor**, **AnakAngkat** (sponsorship) and **FosterApplication**. The sponsor store is hosted provisionally by M17 today (Q-M17-SPONSORS, XR-M17-16); ownership moves to M21 with no value change (C1, XR-M21-03). Users (sponsor logins, students, the parent, applicant roles) are M01 / M02's and are read through their contract (C4, XR-M21-01 / 02). The "Hadiah" count reads M15 (C6, XR-M21-04); free access is M19's and is not written by M21 (C7, XR-M21-05); "Via Agent" is a stored channel value only (C8, XR-M21-06).

---

## 2. Actors

| Role | Involvement in M21 | Verified |
|---|---|---|
| Admin | S1–S5 (sponsors, anak angkat, applications); S6 as any user; S7 (served without redirect); admin-panel sidebar group "Pengguna" and bottom-nav "Penaja"; user-menu entry "Mohon Keluarga Angkat"; 403 on the sponsor portal | OBSERVED |
| Pelajar (student) | S6 for themselves (user-menu entry "Mohon Keluarga Angkat" in the live student menu); may be searched, assigned, pooled and sponsored | Menu OBSERVED (roles-matrix screenshot); page INFERRED (no student account on lane 1; OQ-M21-07) |
| Ibu Bapa (parent), Guru / Kaunselor | S6 for a child / pupil (S6 copy "Siapa boleh mohon?"); no menu entry in the rebuild shell (not observed) | INFERRED (OQ-M21-07) |
| Penaja (sponsor) | Self-registration S7 (guest); PROPOSED minimum portal `/sponsor/*` once approved (EP-M21-6) | INFERRED / PROPOSED (OQ-M21-01) |
| Guest | S7 public; every other M21 route → `/login` | OBSERVED |
| System (mock) | E-mail notices promised by S7 are simulated (D14, DV-M21-14) | PROPOSED |

---

## 3. Functional breakdown (Epic → Feature → Function)

Compiled from the element inventory. "EL" lists inventory element IDs (prefix `EL-M21-`). Functions with EL "—" are behaviours (access rules, shell entries rendered by the global shell, data rules, unobservable or PROPOSED states) with no content element of their own.

### EP-M21-1 — Navigation, shell, access, error outcomes and shared formats

**FT-M21-1.1 — Menu entries, header titles and tab titles**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M21-1.1.1 | Admin-panel sidebar group toggle **"Pengguna"** (group key `pengguna`, shared with M02's Senarai Pengguna, Sekolah, Langganan Sekolah, Import Pelajar, Pelajar Komplimen, Import Pengguna) holding, after M02's items, **"Penajaan"** (`fa-handshake`) → `/admin/sponsors`, **"Anak Angkat"** (`fa-child`) → `/admin/anak-angkat` and **"Permohonan"** (`fa-file-alt`) → `/admin/anak-angkat/permohonan`; the group opens itself with "Penajaan" active on S1–S3, "Anak Angkat" on S4, "Permohonan" on S5; the admin mobile bottom nav (below `lg`) shows **"Penaja"** (`fa-handshake`) → `/admin/sponsors`. Rendered by the global admin shell (SHA-042–044, SHA-138, excluded in §6.2 as shell chrome); M21 registers the routes | — | Admin (OBSERVED) | OBSERVED |
| FN-M21-1.1.2 | User-portal shell menu entry **"Mohon Keluarga Angkat"** (`fa-hand-holding-heart`, pink) → `/mohon-keluarga-angkat` in the group **"💎 KILLER FEATURES"** after "Pembetulan" and before "Penguasaan", for the student and the admin (live menus; already in the global shell `user-nav.ts`); not shown to other roles (as the shell) (SHU-056, excluded in §6.2) | — | Student, Admin (OBSERVED); other roles (INFERRED) | OBSERVED |
| FN-M21-1.1.3 | Shell header title / subtitle per screen: S1 **"Pengurusan Penaja"** / **"Semak dan urus permohonan penaja"**; S2 **"Tambah Penaja Baru"** / **"Daftar penaja baru (auto-diluluskan)"**; S3 **"Edit Penaja"** / {organisation name}; S4 **"Anak Angkat — Sponsorship"** / **"Selamat datang, Admin"**; S5 **"Permohonan Keluarga Angkat"** / **"Selamat datang, Admin"** ("Admin" = first word of the viewer's name, INFERRED; "Admin Demo" → "Admin"); S6 **"Mohon Keluarga Angkat"** / **"Selamat datang kembali"** (live title "Dashboard", D-M21-06 fixed, DV-M21-06) (SHA-118–119, 200–201, 203–204, 206–207, 215; SHU-136–137) | — | Admin (OBSERVED) | OBSERVED + DV-M21-06 |
| FN-M21-1.1.4 | Tab titles (exact live): S1 "Urus Penaja - Admin"; S2 "Tambah Penaja - Admin"; S3 "Edit Penaja - Admin"; S4 "Pengurusan Anak Angkat"; S5 "Permohonan Anak Angkat"; S6 "Mohon Keluarga Angkat"; S7 "Daftar Penaja - PRESTASIPLUS"; global 404 "404 - Halaman Tidak Dijumpai \| PRESTASIPLUS" and 403 "403 - Akses Ditolak \| PRESTASIPLUS" (M01) | — | All (Admin OBSERVED) | OBSERVED |
| FN-M21-1.1.5 | Shell by screen: S1–S5 render in the **admin-panel shell** (SHA); S6 in the **user-portal shell** (SHU: coin / mata / streak chips, bell, avatar menu; the hidden M16 tournament banner "LIVE:", "MAIN", "DAFTAR" inside `<main>` is not M21 content, EL S6-001–003 excluded in §6.1); S7 has **no shell**: a gradient page with a centred card and footer links, like the M01 login / register pages; the global error pages are standalone (M01) | — | All (Admin OBSERVED) | OBSERVED |
| FN-M21-1.1.6 | Entry links owned elsewhere that land on M21: M01 register page "Mewakili organisasi? **Daftar sebagai Penaja**" → `/sponsor/register` (M01 FR-M01-17) and M08 student profile CTA **"Jadi Penaja"** (`fa-heart`) → `/sponsor/register`; S6 "sini" → `/register` (M01); S7 "Log Masuk" → `/login`, "Daftar Sebagai Pelajar" → `/register`, "Kembali ke Laman Utama" → `/`. M21 registers `/sponsor/register` as a public route | — | Guest, all | OBSERVED |

**FT-M21-1.2 — Access and error outcomes**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M21-1.2.1 | Guest: S1, S2, S3, S4, S5, S6 and the sponsor portal redirect to `/login` (M01 guard); **S7 is public** and is also served to a signed-in user without a redirect (OBSERVED for the admin) | — | Guest, Admin | OBSERVED |
| FN-M21-1.2.2 | S1–S5 and their write actions are **admin only**: another signed-in role opening `/admin/sponsors*` or `/admin/anak-angkat*` is sent to its M01 landing page; the admin APIs answer `403 FORBIDDEN` | — | Admin (OBSERVED); other roles (INFERRED) | OBSERVED (admin) / INFERRED |
| FN-M21-1.2.3 | S6 opens for every signed-in role (INFERRED from the S6 copy "Pelajar sendiri", "Ibu bapa", "Guru / Kaunselor"); the menu entry follows FN-M21-1.1.2 | — | All signed-in | INFERRED (OQ-M21-07) |
| FN-M21-1.2.4 | Sponsor portal `/sponsor`, `/sponsor/anak-angkat`, `/sponsor/anak-angkat/pool`, `/sponsor/rewards`: any signed-in user who is not an approved sponsor sees the global **403** page (standalone): "403", "🚫", h1 **"Akses Ditolak"**, "Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir.", "Halaman Utama" → `/`, "Log Masuk" → `/login`, "PRESTASIPLUS" (OBSERVED for the admin; for a pending / rejected / suspended sponsor PROPOSED, FN-M21-6.1.1) | — | Admin (OBSERVED); others (INFERRED / PROPOSED) | OBSERVED / PROPOSED |
| FN-M21-1.2.5 | Global **404** page (M01, standalone): "404", "🔍", h1 **"Halaman Tidak Dijumpai"**, "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama" → `/`, "Mula Latihan" → `/latih-tubi`, "PRESTASIPLUS" — for an unknown id on S3 (`/admin/sponsors/999999/edit`), for `/admin/anak-angkat/permohonan/{id}` (no detail route) and for every probed route of §1 (OBSERVED, replicated) | S3-053–059, S5-031–037 | All | OBSERVED |
| FN-M21-1.2.6 | `GET /admin/anak-angkat/{x}` (e.g. `/2`, `/create`, `/pool`, `/sponsors`) and `GET /sponsor/profile` (reachable only by typing the URL) render the global **404** page instead of the unbranded Symfony page "Oops! An Error Occurred" / "The server returned a "405 Method Not Allowed"." / "Something is broken. …" (D-M21-02 fixed, DV-M21-02) | S4-047–049 | All | OBSERVED (live outcome) + DV-M21-02 |
| FN-M21-1.2.7 | `GET /admin/sponsors/{id}` (the S1 row link "Lihat") opens S3 of that sponsor (redirect to `/admin/sponsors/{id}/edit`) instead of the global **500** page "⚙️" "Ralat Pelayan" / "Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar lagi." / "Cuba Semula" (D-M21-01 fixed, DV-M21-01); an unknown id → 404 | S3-060–063 | Admin (OBSERVED) | OBSERVED (live 500) + DV-M21-01 |

**FT-M21-1.3 — Shared formats, labels, pagination and responsive rules**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M21-1.3.1 | Dates: **"dd/mm/yyyy"** in MYT ("31/03/2026", "06/02/2026") on S1 "Tarikh", S3 "Tarikh Daftar", S4 "Tarikh" | — | Admin (OBSERVED) | OBSERVED |
| FN-M21-1.3.2 | Labels (Appendix A of discovery): sponsor category code → BM label (13); sponsor status `PENDING` "Menunggu", `APPROVED` "Diluluskan", `REJECTED` "Ditolak", `SUSPENDED` "Digantung"; anak-angkat status badge = the capitalised English word ("Active"; "Graduated", "Withdrawn", "Expired" INFERRED from the tab labels); channel `direct` "Direct", `mlm` "Via Agent"; application status badge "Pending" (`approved` "Approved", `matched` "Matched", `rejected` "Rejected" INFERRED, same pattern); applicant role shown raw ("parent", "student"). Mixed language kept (DV-M21-10) except the raw codes fixed by DV-M21-08 (S3 strip status, S4 sponsor category line, S5 empty states) | — | Admin (OBSERVED) | OBSERVED / INFERRED |
| FN-M21-1.3.3 | Pagination: S1, S4 and S5 are paged lists; page size **20** (PROPOSED; any size ≥ 6 reproduces live, OQ-M21-09); with the seed no pager renders. A page beyond the last (S1 `?page=2`, typed URL) shows the empty row, the count line with **the count of all matches** ("6 penaja dijumpai") and the Laravel pager in English: "« Previous" (disabled), "Next »" (disabled), **"Showing 0 of 6 results"** and the page link "1" (D-M21-04 replicated, DV-M21-04); the pager keeps the query values | S1-040–045 | Admin (OBSERVED) | OBSERVED / PROPOSED (size) |
| FN-M21-1.3.4 | Loading and errors: data views show the shared shell loading behaviour while the mock responds and the M01 global error convention on a mock failure; confirms are browser `confirm()` dialogs as live; no M21-specific loading copy exists on live | — | All | INFERRED (M01 convention) |
| FN-M21-1.3.5 | Responsive: every M21 screen works at 375 / 768 / 1280 px **without horizontal page scroll** — the S3 status card (+49 px at 375) and the S4 status tabs (+37 px at 375) wrap (D-M21-05 fixed, DV-M21-05); tables scroll inside their cards as live; **no content text below 12 px** (live 9–10 px on the S1 table at 375; on S4 the sponsor category line, the student-cell e-mail line, the badges and "Graduate" / "Tarik"; the S4 student-search second line; on S5 both student-cell lines, the badges, "Lulus" and "Tolak"; the S6 note; on S7 at 375 the 13 tile labels, the 3 step pills and the 4 footer texts; D-M21-07 fixed, DV-M21-07); per-screen grids as measured on live (SRS §10) | — | All | OBSERVED + DV-M21-05 / 07 |

### EP-M21-2 — Sponsor administration (S1–S3)

**FT-M21-2.1 — Sponsor list `/admin/sponsors` (S1)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M21-2.1.1 | Five stat cards (2 columns at 375, 5 from 768): **"Jumlah"** (all sponsors), **"Menunggu"** (`PENDING`), **"Diluluskan"** (`APPROVED`), **"Ditolak"** (`REJECTED`), **"Digantung"** (`SUSPENDED`) — **global** (they never follow the filter, OBSERVED on all 11 filter states). Seed: 6 / 0 / 0 / 0 / 6 | S1-001–015 | Admin (OBSERVED) | OBSERVED |
| FN-M21-2.1.2 | Count line **"{n} penaja dijumpai"** (n = sponsors matching the filters, all pages: "6 penaja dijumpai", "1 penaja dijumpai", "0 penaja dijumpai") and gradient button link **"Tambah Penaja"** (`fa-plus-circle`) → S2 | S1-016–017, S1-038, S1-046 | Admin (OBSERVED) | OBSERVED |
| FN-M21-2.1.3 | GET filter card: **"Carian"** input `search` placeholder **"Nama, email..."**; **"Status"** select `status` ("" **"Semua Status"**, `PENDING` "Menunggu", `APPROVED` "Diluluskan", `REJECTED` "Ditolak", `SUSPENDED` "Digantung"); **"Kategori"** select `category` ("" **"Semua Kategori"** + the 13 categories); button **"Cari"** (`fa-search`); the values stay selected after submit; a **"Reset"** link (`fa-times`) → `/admin/sponsors` appears once any filter is set | S1-018–026, S1-039 | Admin (OBSERVED) | OBSERVED |
| FN-M21-2.1.4 | Filter semantics: `search` = trimmed, case-insensitive "contains" on the organisation name or the linked login e-mail (INFERRED fields from the placeholder; "Kedai" → #6, "zzqxv" → none OBSERVED); `status` compared case-insensitively with the status code (`suspended` = `SUSPENDED`, OBSERVED); `category` = the category code; conditions combine with AND; an unknown value matches nothing. Observed: `SUSPENDED` 6, `PENDING` / `APPROVED` / `REJECTED` 0, `SYARIKAT_SWASTA` 6, `INDIVIDU` 0 | — | Admin (OBSERVED) | OBSERVED (results) / INFERRED (fields) |
| FN-M21-2.1.5 | Table (scrolls inside its card) with the columns **"#"**, **"Organisasi"**, **"Kategori"**, **"Pegawai"**, **"Status"**, **"Tarikh"**, **"Tindakan"**: "#" = sponsor id; "Organisasi" = organisation name (bold) + the linked login e-mail (small; none when the sponsor has no login, PROPOSED); "Kategori" = building icon + category label ("Syarikat Swasta"); "Pegawai" = contact officer name + telephone, or **"-"**; "Status" = status badge (**"Digantung"**, `fa-ban`, orange; the other statuses' icons and colours INFERRED); "Tarikh" = registration date | S1-027–029, S1-032, S1-035 | Admin (OBSERVED) | OBSERVED |
| FN-M21-2.1.6 | Row actions: **"Lihat"** (`fa-eye`) → `/admin/sponsors/{id}`, which opens S3 (FN-M21-1.2.7, DV-M21-01); **"Edit"** (`fa-edit`) → `/admin/sponsors/{id}/edit` (S3) | S1-030–031, S1-033–034, S1-036–037 | Admin (OBSERVED) | OBSERVED + DV-M21-01 |
| FN-M21-2.1.7 | Order: registration time descending, ties by id ascending (INFERRED; reproduces #11 first, then #6 → #10) | — | Admin (OBSERVED) | OBSERVED (order) / INFERRED (rule) |
| FN-M21-2.1.8 | Empty state (filter with no match or page beyond the last): one table row **"Tiada penaja dijumpai"**; the count line reads "0 penaja dijumpai" for a filter with no match | — | Admin (OBSERVED) | OBSERVED |

**FT-M21-2.2 — Add sponsor `/admin/sponsors/create` (S2)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M21-2.2.1 | Link **"Kembali ke Senarai Penaja"** (`fa-arrow-left`) → S1; one card with the form `POST` to the sponsors endpoint with the CSRF token | S2-001–003 | Admin (OBSERVED) | OBSERVED |
| FN-M21-2.2.2 | Section **"Maklumat Organisasi"** (`fa-building`; 2 columns from 768): **"Nama Organisasi \*"** `name` (text, required, placeholder **"cth: Kedai Buku Popular"**); **"Kategori \*"** `category` (select, required, the 13 categories, **no empty option**, first "Individu / Peribadi"); **"Penerangan"** `description` (textarea, placeholder **"Penerangan ringkas organisasi..."**); **"Tagline"** `tagline` (placeholder **"cth: Membaca Jambatan Ilmu"**); **"Website"** `website` (type url, placeholder **"https://example.com"**); **"URL Logo"** `logo_url` (text, placeholder **"https://example.com/logo.png"**); **"No. Pendaftaran (SSM/ROC)"** `registration_number` (no placeholder) | S2-004–018 | Admin (OBSERVED) | OBSERVED |
| FN-M21-2.2.3 | Section **"Maklumat Pegawai Perhubungan"** (`fa-user-tie`): **"Nama Pegawai"** `contact_person_name`, **"Jawatan"** `contact_person_position`, **"Email"** `contact_email` (type email), **"Telefon"** `contact_phone` — all optional, no placeholders | S2-019–027 | Admin (OBSERVED) | OBSERVED |
| FN-M21-2.2.4 | Section **"Alamat"** (`fa-map-marker-alt`; 3 columns from 768): **"Alamat"** `address`, **"Bandar"** `city`, **"Negeri"** `state` (**free text**, as live — S7 uses a select; D-M21-11 replicated, DV-M21-11), **"Poskod"** `postcode` — all optional | S2-028–036 | Admin (OBSERVED) | OBSERVED |
| FN-M21-2.2.5 | Buttons **"Tambah Penaja"** (`fa-plus-circle`, gradient, submit) and **"Batal"** → S1 | S2-037–038 | Admin (OBSERVED) | OBSERVED |
| FN-M21-2.2.6 | Create effects (never submitted on live): the browser `required` / `type` checks run first; the server validates the same rules and returns the form with per-field messages (PROPOSED COPY, SRS §8.2); on success a sponsor is created with the next id, status **`APPROVED`** (INFERRED from "auto-diluluskan"), no login account (S2 has no login fields), "Hadiah" 0, registration time now; the admin lands on S1 with no flash text (PROPOSED); the new sponsor is listed in the S4 "Penaja" select (FN-M21-3.1.2) | — | Admin | INFERRED / PROPOSED |

**FT-M21-2.3 — Edit sponsor `/admin/sponsors/{id}/edit` (S3)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M21-2.3.1 | Link **"Kembali ke Senarai Penaja"** (`fa-arrow-left`) → S1; form `POST` with `_method=PUT` and the CSRF token; the same three sections and fields as S2 (FN-M21-2.2.2–2.2.4), **prefilled from the sponsor and without any placeholder** (as live); "Negeri" free text | S3-001–037 | Admin (OBSERVED) | OBSERVED |
| FN-M21-2.3.2 | Summary strip under "Alamat": status label with the caption **"Status"** (live raw "SUSPENDED" → **"Digantung"**, D-M21-08 fixed, DV-M21-08), the "Hadiah" count with **"Hadiah"** (Q-M21-SPONSOR-REWARDS; 0 for every seed sponsor), the registration date with **"Tarikh Daftar"** ("06/02/2026"; #11 "31/03/2026") | S3-038–043, S3-064 | Admin (OBSERVED) | OBSERVED + DV-M21-08 |
| FN-M21-2.3.3 | Buttons **"Kemaskini Penaja"** (`fa-save`, submit) and **"Batal"** → S1 | S3-044–045 | Admin (OBSERVED) | OBSERVED |
| FN-M21-2.3.4 | Separate **status card**: a blue `fa-toggle-on` icon, **"Status Penaja:"**, a coloured dot and the status label (**"Digantung"**, red dot) followed by the code in parentheses **"(SUSPENDED)"** (kept as live, DV-M21-08; OBSERVED for SUSPENDED only — the same "{label} ({code})" pattern for PENDING / APPROVED / REJECTED is INFERRED); for a `SUSPENDED` sponsor a form `POST …/reactivate` (CSRF) with the button **"Aktifkan Semula"** (`fa-play-circle`, green) after the browser confirm **"Aktifkan semula penaja ini?"**; at 375 the card wraps so the page does not scroll sideways (DV-M21-05) | S3-046–052 | Admin (OBSERVED) | OBSERVED / SOURCE-DERIVED (never submitted) |
| FN-M21-2.3.5 | Update effects (PROPOSED; never submitted): the same validation as S2; the sponsor's fields are updated (status, login link, "Hadiah" and registration date unchanged); the admin lands on S1 with no flash text | — | Admin | PROPOSED |
| FN-M21-2.3.6 | Reactivate effects (INFERRED; never submitted): Cancel changes nothing; OK sets the status `SUSPENDED` → **`APPROVED`**; the admin returns to S3 of the sponsor with no flash text (PROPOSED), where the status card reads "Diluluskan" "(APPROVED)" (the "{label} ({code})" pattern is INFERRED for statuses other than SUSPENDED) and shows no reactivate form; every count recomputes (S1 cards, S4 select, M17 cards) | — | Admin | INFERRED / PROPOSED |
| FN-M21-2.3.7 | Status actions for a **`PENDING`** sponsor (not observable, OQ-M21-02; PROPOSED minimum so that a self-registered sponsor can be reviewed, as the S1 subtitle "Semak dan urus permohonan penaja" and the S7 note promise): the status card shows **"Luluskan"** (`fa-check`) with the confirm **"Luluskan penaja ini?"** → `APPROVED`, and **"Tolak"** (`fa-times`) with the confirm **"Tolak penaja ini?"** → `REJECTED` (PROPOSED COPY); an `APPROVED` or `REJECTED` sponsor shows the status line only (no suspend, re-approve or delete action is added, OQ-M21-02); the status dot colour of the other statuses is INFERRED | — | Admin | PROPOSED |

### EP-M21-3 — Anak angkat administration (S4)

**FT-M21-3.1 — Anak angkat `/admin/anak-angkat` (S4)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M21-3.1.1 | Four stat cards (2 columns at 375, 4 from 768), **global** (they never follow the tab): **"Jumlah Penaja"** = number of distinct sponsors that have at least one anak-angkat record, any status (C2; INFERRED definition that reproduces the observed 1 next to S1 "Jumlah" 6, Q-M21-AA-SPONSORS); **"Pelajar Aktif Ditaja"** (status `active`), **"Graduated"** (`graduated`), **"Withdrawn"** (`withdrawn`). Seed: 1 / 1 / 0 / 0 | S4-001–012 | Admin (OBSERVED) | OBSERVED / INFERRED (definition) |
| FN-M21-3.1.2 | Card **"Assign Anak Angkat"** (`fa-user-plus`), form `POST …/assign` (CSRF): **"Penaja"** select `sponsor_id` (required) with the placeholder option **"Pilih Penaja"** followed by one option per **approved** sponsor (organisation name, INFERRED rule; the seed lists none because all 6 are suspended, as live) | S4-013–018 | Admin (OBSERVED) | OBSERVED / INFERRED |
| FN-M21-3.1.3 | **"Cari Pelajar (nama/email)"** search box, placeholder **"Taip nama atau email..."**: from **2** typed characters and after a **300 ms** pause the student search (M02 contract) runs (SOURCE-DERIVED); a dropdown lists one clickable row per result (live Alpine template `x-for="s in results"`, read from the page source with nothing typed; SOURCE-DERIVED): line 1 the student's **name** (bold, `x-text="s.name"`), line 2 **"{e-mail}"** followed by **" · {school name}"** when the student has a school (`x-text="s.email + (s.school ? ' · ' + s.school : '')"`; live 10 px → at least 12 px, DV-M21-07); clicking a row fills the hidden `student_email` and shows the line "{name} ({e-mail})"; with fewer than 2 characters no search runs. Only the result limit (≤ 10) and which students are searchable (students only) are PROPOSED (OQ-M21-04) | S4-019–023 | Admin (OBSERVED) | SOURCE-DERIVED / PROPOSED (limit, scope) |
| FN-M21-3.1.4 | **"Kategori"** select `student_category` ("" **"-"**, `B40`, `Asnaf`, `Yatim`, `OKU` — no "Lain-lain", as live); **"Saluran"** select `channel` (`required`; `direct` **"Direct"**, `mlm` **"Via Agent"**); button **"Assign"** (`fa-plus`) | S4-024–028 | Admin (OBSERVED) | OBSERVED |
| FN-M21-3.1.5 | Assign effects (never submitted; PROPOSED minimum): the sponsor must be approved and the e-mail must be a student account (M02); the category may be empty ("-"); a new anak-angkat record is created with status `active`, the chosen channel and the registration time now; the admin returns to S4 (tab "Semua") with no flash text; a missing student shows the message of SRS §8.2 (PROPOSED COPY); no duplicate rule is added (OQ-M21-12) | — | Admin | PROPOSED |
| FN-M21-3.1.6 | Status tabs (links): **"Semua ({n})"** `?status=all` (default), **"Aktif ({n})"** `?status=active`, **"Graduated ({n})"**, **"Withdrawn ({n})"**, **"Expired ({n})"**; the active tab is filled blue; every count is global — **"Semua" always shows the total of all records** (live shows the count of the current filter, "Semua (0)" on the Graduated tab while 1 record exists; D-M21-03 fixed, DV-M21-03); at 375 the tabs wrap (DV-M21-05) | S4-029–033, S4-050 | Admin (OBSERVED) | OBSERVED + DV-M21-03 |
| FN-M21-3.1.7 | Table (scrolls inside its card) **"#"**, **"Penaja"**, **"Pelajar"**, **"Kategori"**, **"Saluran"**, **"Status"**, **"Tarikh"**, **"Aksi"**: "Penaja" = organisation name + its category label (live shows the raw code "SYARIKAT_SWASTA", D-M21-08 fixed → "Syarikat Swasta", DV-M21-08); "Pelajar" = student name + e-mail; "Kategori" = badge ("B40", amber) or "-"; "Saluran" = badge ("Direct", blue); "Status" = badge ("Active", green); "Tarikh" = creation date; the sponsor category line, the student e-mail line, the badges and the buttons at least 12 px (live 10 px at every width, DV-M21-07) | S4-034–038 | Admin (OBSERVED) | OBSERVED + DV-M21-08 |
| FN-M21-3.1.8 | Row actions on an `active` row only: form `POST …/{id}/status` with `status=graduated`, button **"Graduate"** (blue), and form with `status=withdrawn`, button **"Tarik"** (red) — **no confirm** on either (as live); effects (INFERRED): the record's status becomes `graduated` / `withdrawn`, the admin returns to S4 on the same tab with no flash text (PROPOSED), the row shows no action | S4-039–046 | Admin (OBSERVED) | SOURCE-DERIVED (never submitted) / INFERRED |
| FN-M21-3.1.9 | Order id descending (PROPOSED; one row observed); empty state one row **"Tiada rekod"** (OBSERVED on Graduated / Withdrawn / Expired); `expired` records are listed under "Expired"; no automatic expiry is built (INFERRED end of the school session, OQ-M21-11) | — | Admin (OBSERVED) | OBSERVED / PROPOSED |

### EP-M21-4 — Foster-family applications (S5, S6)

**FT-M21-4.1 — Applications `/admin/anak-angkat/permohonan` (S5)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M21-4.1.1 | Four status tabs as cards (2 columns at 375, 4 from 768), each a link with a **global** count: **"Menunggu {n}"** `?status=pending` (default), **"Dalam Pool {n}"** `?status=approved`, **"Ditaja {n}"** `?status=matched`, **"Ditolak {n}"** `?status=rejected`; the current tab is highlighted. Seed: 3 / 0 / 0 / 0 | S5-001–004 | Admin (OBSERVED) | OBSERVED |
| FN-M21-4.1.2 | Table (scrolls inside its card at 375 / 768) **"#"**, **"Pelajar"**, **"Pemohon"**, **"Kategori"**, **"Sebab"**, **"Status"**, **"Aksi"**: "Pelajar" = student name (bold) + e-mail + school name or **"-"**; "Pemohon" = applicant name + applicant role raw ("parent", "student"); "Kategori" = badge ("B40"); "Sebab" = reason; "Status" = badge **"Pending"** (amber); text at least 12 px, including both student-cell lines (e-mail, school), the badges, "Lulus" and "Tolak" (live 10 px, DV-M21-07) | S5-005–008, S5-015–016, S5-023–024 | Admin (OBSERVED) | OBSERVED |
| FN-M21-4.1.3 | **"Lulus"** (`fa-check`, blue) on a `pending` row: form `POST …/{id}/lulus` (CSRF), **no confirm** (as live); effect (INFERRED from the tabs): status → `approved` ("Dalam Pool"); the admin returns to S5 on the same tab with no flash text (PROPOSED) | S5-009–011, S5-017–019, S5-025–027 | Admin (OBSERVED) | SOURCE-DERIVED (never submitted) / INFERRED |
| FN-M21-4.1.4 | **"Tolak"** (`fa-times`, red) on a `pending` row: form `POST …/{id}/tolak` (CSRF) after the confirm **"Tolak permohonan ini?"**; Cancel changes nothing; OK → status `rejected` ("Ditolak"); the admin returns to S5 on the same tab with no flash text (PROPOSED) | S5-012–014, S5-020–022, S5-028–030 | Admin (OBSERVED) | SOURCE-DERIVED (never submitted) / INFERRED |
| FN-M21-4.1.5 | Empty state per tab: one row **"Tiada permohonan menunggu"**, **"Tiada permohonan dalam pool"**, **"Tiada permohonan ditaja"**, **"Tiada permohonan ditolak"** (live "Tiada permohonan approved / matched / rejected" with the raw status; D-M21-08 fixed, DV-M21-08; the pending text is the same pattern, INFERRED) | — | Admin (OBSERVED) | OBSERVED + DV-M21-08 |
| FN-M21-4.1.6 | Order id descending (OBSERVED #3, #2, #1); "Sebab" shows the first **80 characters followed by "..."** when the reason is longer (OBSERVED: 83 characters shown), otherwise the full text; there is no tooltip and no full-text view (as live, OQ-M21-06) | — | Admin (OBSERVED) | OBSERVED |
| FN-M21-4.1.7 | Rows in the other statuses (not observable, OQ-M21-05): badge = the capitalised raw status ("Approved", "Matched", "Rejected"; INFERRED pattern of "Pending") and **no action** (PROPOSED) | — | Admin | INFERRED / PROPOSED |

**FT-M21-4.2 — Application form `/mohon-keluarga-angkat` (S6)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M21-4.2.1 | Gradient hero: H1 **"Mohon Keluarga Angkat"** (24 px at every width) and **"Isi borang ini untuk memohon tajaan akses PrestasiPlus secara percuma."**; single centred column (max ~670 px) at every width | S6-004–005 | All signed-in (Admin OBSERVED) | OBSERVED |
| FN-M21-4.2.2 | **"Email Pelajar"** `student_email` (email, required, placeholder **"pelajar@email.com"**) with the hint **"Email pelajar yang berdaftar dalam PrestasiPlus. Jika pelajar belum daftar, minta mereka daftar terlebih dahulu di "** + link **"sini"** → `/register` + "." | S6-006, S6-009–012 | All signed-in (Admin OBSERVED) | OBSERVED |
| FN-M21-4.2.3 | **"Kategori Pelajar"** `student_category` (required): "" **"Pilih kategori"**, `B40` **"B40 — Pendapatan rendah"**, `Asnaf` **"Asnaf — Layak bantuan zakat"**, `Yatim` **"Yatim — Tiada ibu/bapa"**, `OKU` **"OKU — Orang kurang upaya"**, `Lain-lain` **"Lain-lain"**; **"Anggaran Pendapatan Keluarga"** `family_income_range` (optional): "" **"Pilih (pilihan)"**, `< RM1,000` **"Bawah RM1,000"**, `RM1,000 - RM2,500` **"RM1,000 - RM2,500"**, `RM2,500 - RM4,000` **"RM2,500 - RM4,000"**, `> RM4,000` **"Atas RM4,000"** | S6-013–016 | All signed-in (Admin OBSERVED) | OBSERVED |
| FN-M21-4.2.4 | **"Sebab Permohonan"** `reason` (textarea, 4 rows, required, no length limit, placeholder **"Terangkan kenapa pelajar ini memerlukan tajaan..."**); grey box **"Contoh sebab permohonan:"** (`fa-lightbulb`) with the 5 clickable examples (exact texts, discovery §2.6), each click **replaces** the textarea value with the example text **including its leading "• "** (client-side only, no request; D-M21-09 replicated, DV-M21-09); italic note **"Klik mana-mana contoh untuk guna sebagai template. Sila ubahsuai mengikut situasi sebenar."** (at least 12 px, DV-M21-07) | S6-017–025 | All signed-in (Admin OBSERVED) | OBSERVED |
| FN-M21-4.2.5 | Form `POST` (CSRF) with the full-width button **"Hantar Permohonan"** (`fa-paper-plane`). Submit effects (never submitted; PROPOSED minimum): browser `required` / `type=email` checks first; the server requires the e-mail to belong to a **student** account (M02; hint INFERRED) and otherwise returns the form with the message of SRS §8.2; on success an application is created with status `pending`, the student, the applicant = the viewer and the applicant role = the viewer's role code, the category, the income range (or none) and the reason as typed; the viewer returns to S6 with an empty form and the PROPOSED success notice of SRS §8.2; no duplicate rule (OQ-M21-12) | S6-007–008, S6-026 | All signed-in | OBSERVED (form) / PROPOSED (effects) |
| FN-M21-4.2.6 | Info box **"Apa yang berlaku selepas mohon?"** — ordered list "Admin semak dan luluskan permohonan (1-3 hari bekerja)", "Pelajar masuk ke pool — sponsor/keluarga angkat boleh pilih", "Bila sponsor pilih, pelajar dapat akses PERCUMA PrestasiPlus selama 1 sesi persekolahan", "Keluarga angkat boleh pantau prestasi pelajar dari dashboard mereka"; **"Siapa boleh mohon?"** — **"Pelajar sendiri"** "— mohon untuk diri sendiri", **"Ibu bapa"** "— mohon untuk anak", **"Guru / Kaunselor"** "— mohon untuk pelajar yang dikenal pasti memerlukan" (static copy) | S6-027–038 | All signed-in (Admin OBSERVED) | OBSERVED |

### EP-M21-5 — Public sponsor registration (S7)

**FT-M21-5.1 — Sponsor registration `/sponsor/register` (S7)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M21-5.1.1 | Gradient page with a centred card: H1 **"PRESTASIPLUS"** (24 px at 375, 48 px from 768) and **"Pendaftaran Penaja"**; three step pills **"Organisasi"** (`fa-building`), **"Hubungan"** (`fa-user`), **"Akaun"** (`fa-lock`) joined by bars; the current pill is active and a completed step's bar turns green; pill labels at least 12 px at every width (live 10 px at 375, DV-M21-07) | S7-001–005 | Guest, all (OBSERVED) | OBSERVED |
| FN-M21-5.1.2 | Step 1 **"Maklumat Organisasi"**: **"Nama Organisasi / Syarikat \*"** `organization_name` (required, placeholder **"Contoh: Syarikat ABC Sdn Bhd"**); **"Kategori Penaja \*"** = 13 icon tiles (2 columns at 375, 3 from 768; labels at least 12 px, DV-M21-07) that set the hidden `category`, the selected tile highlighted — "Individu / Peribadi" `fa-user`, "Syarikat Swasta" `fa-building`, "Syarikat Berkaitan Kerajaan" `fa-landmark`, "Pertubuhan Bukan Kerajaan" `fa-hands-helping`, "Badan / Agensi Kerajaan" `fa-university`, "Bank / Institusi Kewangan" `fa-piggy-bank`, "Universiti / IPT" `fa-graduation-cap`, "Persatuan / Kesatuan" `fa-users`, "Koperasi" `fa-handshake`, "Kedai Buku / Alat Tulis" `fa-book-reader`, "Restoran / F&B" `fa-utensils`, "Syarikat Teknologi" `fa-laptop-code`, "Penyedia Pendidikan" `fa-chalkboard-teacher`; **"No. Pendaftaran (SSM/ROC)"** `registration_number` (placeholder **"Contoh: 202001012345"**); **"Penerangan Organisasi"** `description` (placeholder **"Ringkasan tentang organisasi anda..."**); **"Laman Web"** `website` (url, placeholder **"https://contoh.com"**); button **"Seterusnya"** (`fa-arrow-right`) → step 2 when a tile is selected, otherwise the browser alert **"Sila pilih kategori penaja."** and the step stays | S7-008–033 | Guest, all (OBSERVED) | OBSERVED |
| FN-M21-5.1.3 | Step 2 **"Maklumat Hubungan & Alamat"**: **"Nama Pegawai Perhubungan \*"** `contact_person_name` ("Nama penuh"); **"Jawatan"** `contact_person_position` ("Contoh: Pengurus"); **"E-mel Perhubungan \*"** `contact_email` (email, "email@organisasi.com"); **"No. Telefon \*"** `contact_phone` (tel, "012-3456789"); **"Alamat \*"** `address` (textarea, "No. lot, jalan, taman..."); **"Bandar \*"** `city` ("Kluang"); **"Negeri \*"** `state` select ("" **"Pilih negeri"**, Johor, Kedah, Kelantan, Melaka, Negeri Sembilan, Pahang, Perak, Perlis, Pulau Pinang, Sabah, Sarawak, Selangor, Terengganu, W.P. Kuala Lumpur, W.P. Putrajaya, W.P. Labuan); **"Poskod \*"** `postcode` ("86000", `maxlength=5`); buttons **"Kembali"** (`fa-arrow-left`) → step 1 with values kept and **"Seterusnya"** → step 3 **without validation** (as live) | S7-034–052 | Guest, all (OBSERVED) | OBSERVED |
| FN-M21-5.1.4 | Step 3 **"Akaun Log Masuk"**: **"Nama Penuh Anda \*"** `name` ("Nama anda"); **"E-mel Log Masuk \*"** `email` ("anda@email.com"); **"Kata Laluan \*"** `password` ("Minimum 6 aksara") and **"Sahkan Kata Laluan \*"** `password_confirmation` ("Taip semula kata laluan"), each with an eye button that switches the field between hidden and shown and its icon between `fa-eye` and `fa-eye-slash`; note (`fa-info-circle`) **"Dengan mendaftar, anda bersetuju bahawa permohonan ini akan disemak oleh pentadbir PRESTASIPLUS. Anda akan dimaklumkan melalui e-mel apabila status permohonan dikemaskini."**; buttons **"Kembali"** → step 2 and **"Hantar Permohonan"** (`fa-paper-plane`, submit) which shows **"Menghantar..."** (`fa-circle-notch`, spinning) while the request is pending | S7-053–068 | Guest, all (OBSERVED) | OBSERVED |
| FN-M21-5.1.5 | Footer, rendered in this order: **"Sudah ada akaun?"** **"Log Masuk"** → `/login` **" · "** **"Daftar Sebagai Pelajar"** → `/register` (the inventory text "Sudah ada akaun? ·" joins the element's two text nodes on either side of the first link); **"Kembali ke Laman Utama"** (`fa-home`) → `/`; all footer texts at least 12 px (live 10 px at 375, DV-M21-07) | S7-069–072 | Guest, all (OBSERVED) | OBSERVED |
| FN-M21-5.1.6 | Form `POST` (CSRF) and submit effects (never submitted; PROPOSED minimum): the browser `required` checks of the 12 required fields (snapshot) run first — a required field of a hidden step blocks the submit, as live (INFERRED); the server validates V-M21-04 (login e-mail unused, password ≥ 6 and confirmed, category and state from their lists) and returns to the step of the first error with the messages of SRS §8.2 (PROPOSED COPY); on success it creates **one login account** (role `sponsor`, name, e-mail, password; M01 / M02 contract) and **one sponsor** linked to it with status **`PENDING`** (INFERRED from "permohonan ini akan disemak") and every organisation / contact / address field; the card is replaced by the PROPOSED success panel of SRS §8.2 with a "Log Masuk" link; the visitor is not signed in; the e-mail notice promised by the note is simulated (D14, DV-M21-14) | S7-006–007 | Guest, all | PROPOSED |

### EP-M21-6 — Sponsor portal (PROPOSED minimum)

**FT-M21-6.1 — Sponsor portal `/sponsor/*`**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M21-6.1.1 | Access: the portal routes open only for a signed-in user with role `sponsor` whose sponsor record is **`APPROVED`**; any other signed-in user (the admin OBSERVED; a pending, rejected or suspended sponsor PROPOSED) sees the global 403 page (FN-M21-1.2.4); a guest → `/login` | — | Admin (OBSERVED); Penaja (PROPOSED) | OBSERVED / PROPOSED |
| FN-M21-6.1.2 | `/sponsor` redirects to `/sponsor/anak-angkat` (PROPOSED); the sponsor's landing page after login is `/sponsor` (PROPOSED; M01 BR-07 sends `sponsor` to `/dashboard` today — XR-M21-02, OQ-M21-01); pages use the user-portal shell; no menu entry is added (not observed) | — | Penaja | PROPOSED |
| FN-M21-6.1.3 | `/sponsor/anak-angkat` (PROPOSED COPY): header **"Anak Angkat Saya"** / {organisation name}; table **"Pelajar"** (name + e-mail), **"Kategori"**, **"Status"**, **"Tarikh"** of the sponsor's own anak-angkat records (id descending, same badges as S4), empty state **"Tiada rekod"**; a link **"Pool Pelajar"** → `/sponsor/anak-angkat/pool` | — | Penaja | PROPOSED |
| FN-M21-6.1.4 | `/sponsor/anak-angkat/pool` (PROPOSED COPY): header **"Pool Pelajar"** / "Pilih pelajar untuk ditaja"; table **"Pelajar"**, **"Kategori"**, **"Sebab"** (truncated as S5) of the applications in status `approved` ("Dalam Pool"), id ascending; button **"Taja"** (`fa-handshake`) after the confirm **"Taja pelajar ini?"** → the application becomes `matched` ("Ditaja") and one anak-angkat record is created for this sponsor (student of the application, category = the application category when it is B40 / Asnaf / Yatim / OKU, otherwise none, channel `direct`, status `active`, now); the sponsor lands on `/sponsor/anak-angkat`; empty state **"Tiada pelajar dalam pool"** | — | Penaja | PROPOSED |
| FN-M21-6.1.5 | `/sponsor/rewards` (live exists, content not observable; relation to M15 unknown, C6): not built; for an approved sponsor it redirects to `/sponsor/anak-angkat` (PROPOSED); the admin and other users see the 403 page (OBSERVED for the admin) | — | Penaja (PROPOSED); Admin (OBSERVED) | OBSERVED / PROPOSED |
| FN-M21-6.1.6 | `POST /sponsor/profile` (POST-only on live; purpose not observable): not built; `GET /sponsor/profile` renders the global 404 page (DV-M21-02) | — | All | OBSERVED (GET 405) + DV-M21-02 |

### EP-M21-7 — Sponsorship data rules and module boundaries

**FT-M21-7.1 — Records, counts and boundaries**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M21-7.1.1 | Sponsor record: `id`, `userId` (linked login, M01 / M02 user with role `sponsor`; none for an admin-created sponsor), `name`, `category` (13 codes), `description`, `tagline`, `website`, `logoUrl`, `registrationNumber`, `contactPersonName`, `contactPersonPosition`, `contactEmail`, `contactPhone`, `address`, `city`, `state` (free text), `postcode`, `status` `PENDING` / `APPROVED` / `REJECTED` / `SUSPENDED`, `createdAt` ("Tarikh Daftar"); "Hadiah" is not stored (FN-M21-7.1.5) | — | System | OBSERVED / INFERRED |
| FN-M21-7.1.2 | Anak-angkat record: `id`, `sponsorId`, `studentId` (M02 student), `studentCategory` `B40` / `Asnaf` / `Yatim` / `OKU` or none, `channel` `direct` / `mlm`, `status` `active` / `graduated` / `withdrawn` / `expired`, `applicationId` (set when created from the pool, PROPOSED), `createdAt` | — | System | OBSERVED / INFERRED |
| FN-M21-7.1.3 | Foster-family application record: `id`, `studentId` (resolved from the e-mail), `applicantUserId`, `applicantRole` (the applicant's role code at submission), `studentCategory` (5 values incl. `Lain-lain`), `familyIncomeRange` (4 values or none), `reason` (text as typed), `status` `pending` / `approved` / `matched` / `rejected`, `createdAt` | — | System | OBSERVED / INFERRED |
| FN-M21-7.1.4 | Every displayed count is a named query over M21's stores (SRS §6.8): S1 cards and count line, S3 "Hadiah" (through M15), S4 cards and tabs, S5 tabs, portal lists; nothing is a display constant. The same sponsor summary is served to M17 (dashboard cards "Jumlah Penaja" 6 / "0 Aktif" / 0 / 0 / 6) through M21's contract, replacing M17's provisional store (C1, XR-M21-03). S1 "Jumlah" (all sponsors, 6) and S4 "Jumlah Penaja" (sponsors with an anak-angkat record, 1) are two named queries on different pages (C2; no D9 needed, DV-M21-13) | — | System | OBSERVED |
| FN-M21-7.1.5 | Boundaries: users (logins, students, parent, roles) are read and created only through the M01 / M02 contract; "Hadiah" = count of M15 reward items linked to the sponsor (M15 contract, 0 for every seed sponsor; XR-M21-04); M21 writes **no** M19 subscription or entitlement — the promised free access "selama 1 sesi persekolahan" is not granted by the prototype until the owner decides (C7, XR-M21-05, OQ-M21-08); channel `mlm` "Via Agent" stores no agent reference (C8, XR-M21-06); no payment and no external screen (D14) | — | System | OBSERVED / INFERRED |
| FN-M21-7.1.6 | Lifecycles: **sponsor** S7 → `PENDING`; S2 → `APPROVED`; `PENDING` → `APPROVED` / `REJECTED` (PROPOSED); `SUSPENDED` → `APPROVED` (reactivate, INFERRED); no transition into `SUSPENDED` is built (OQ-M21-02). **Application** `pending` → `approved` (Lulus) / `rejected` (Tolak); `approved` → `matched` (Taja, PROPOSED). **Anak angkat** created `active` (Assign or Taja) → `graduated` / `withdrawn`; `expired` has no trigger in the prototype (OQ-M21-11). An anak-angkat record stays `active` when its sponsor is suspended (C3, observed #2 under suspended #11) | — | System | OBSERVED / INFERRED / PROPOSED |

---

## 4. User stories

Values in the ACs come from the seed (SRS §6.11: every sponsor, anak-angkat and application value is the observed record of 2026-09-27; people and contact data fictitious) computed at the **project clock 2026-09-25T15:40:00+08:00**. "The admin" = `admin@demo.test` (id 1). Student, parent, sponsor-portal and other non-admin ACs are **provisional** (no such account on live); PROPOSED behaviour is marked in the AC. Every AC runs at 375×812, 768×1024 and 1280×800.

| ID | Feature | MoSCoW | Story | Functions |
|---|---|---|---|---|
| US-M21-01 | FT-M21-1.1 | Must | As an admin, I want the sponsorship entries in the admin sidebar and bottom nav and, as a user, the "Mohon Keluarga Angkat" menu entry, so that I can reach the M21 pages. | FN-M21-1.1.1, 1.1.2, 1.1.5, 1.1.6 |
| US-M21-02 | FT-M21-1.1 | Must | As a user, I want each M21 page's header and tab title to name the page or sponsor, so that I know where I am. | FN-M21-1.1.3, 1.1.4 |
| US-M21-03 | FT-M21-1.2 | Must | As the owner, I want administration limited to admins, the application form to signed-in users, the registration page public and the sponsor portal closed to non-sponsors, so that only the right people act. | FN-M21-1.2.1–1.2.4 |
| US-M21-04 | FT-M21-1.2 | Must | As any user, I want wrong URLs and the "Lihat" link to give a proper page instead of server errors, so that errors are predictable. | FN-M21-1.2.5–1.2.7 |
| US-M21-05 | FT-M21-1.3 | Must | As an admin, I want consistent dates, labels, paging and loading behaviour, so that the pages read the same everywhere. | FN-M21-1.3.1–1.3.4 |
| US-M21-06 | FT-M21-2.1 | Must | As an admin, I want a filterable list of sponsors with status counts, so that I can review sponsor applications. | FN-M21-2.1.1–2.1.5, 2.1.7, 2.1.8 |
| US-M21-07 | FT-M21-2.1 | Must | As an admin, I want to open a sponsor from the list, so that I can see and change its details. | FN-M21-2.1.6 |
| US-M21-08 | FT-M21-2.2 | Must | As an admin, I want to add a sponsor that is approved at once, so that I can onboard partners directly. | FN-M21-2.2.1–2.2.6 |
| US-M21-09 | FT-M21-2.3 | Must | As an admin, I want to edit a sponsor's organisation, contact and address details, so that the records stay correct. | FN-M21-2.3.1–2.3.3, 2.3.5 |
| US-M21-10 | FT-M21-2.3 | Must | As an admin, I want to reactivate a suspended sponsor and approve or reject a pending one, so that only reviewed sponsors take part. | FN-M21-2.3.4, 2.3.6, 2.3.7 |
| US-M21-11 | FT-M21-3.1 | Must | As an admin, I want the anak-angkat figures, tabs and list, so that I can follow every sponsorship. | FN-M21-3.1.1, 3.1.6, 3.1.7, 3.1.9 |
| US-M21-12 | FT-M21-3.1 | Must | As an admin, I want to assign a student to an approved sponsor directly, so that I can arrange a sponsorship without an application. | FN-M21-3.1.2–3.1.5 |
| US-M21-13 | FT-M21-3.1 | Must | As an admin, I want to mark a sponsorship as graduated or withdrawn, so that the list reflects its end. | FN-M21-3.1.8 |
| US-M21-14 | FT-M21-4.1 | Must | As an admin, I want the foster-family applications by status with student, applicant, category and reason, so that I can review them. | FN-M21-4.1.1, 4.1.2, 4.1.5–4.1.7 |
| US-M21-15 | FT-M21-4.1 | Must | As an admin, I want to approve an application into the pool or reject it, so that sponsors only see suitable students. | FN-M21-4.1.3, 4.1.4 |
| US-M21-16 | FT-M21-4.2 | Must | As a student, parent or teacher, I want an application form with example reasons and an explanation of the process, so that I can apply correctly. | FN-M21-4.2.1–4.2.4, 4.2.6 |
| US-M21-17 | FT-M21-4.2 | Must | As a student, parent or teacher, I want to submit the application for a registered student, so that the student can be sponsored. | FN-M21-4.2.5 |
| US-M21-18 | FT-M21-5.1 | Must | As an organisation, I want a three-step registration page, so that I can apply to become a sponsor. | FN-M21-5.1.1–5.1.5 |
| US-M21-19 | FT-M21-5.1 | Must | As an organisation, I want my registration to create my login and a pending sponsor application, so that the administrators can review it. | FN-M21-5.1.6 |
| US-M21-20 | FT-M21-6.1 | Should | As an approved sponsor, I want my own portal that others cannot open, so that I can manage my sponsorships. | FN-M21-6.1.1, 6.1.2, 6.1.5, 6.1.6 |
| US-M21-21 | FT-M21-6.1 | Should | As an approved sponsor, I want to see my sponsored students and pick students from the pool, so that I can sponsor them. | FN-M21-6.1.3, 6.1.4 |
| US-M21-22 | FT-M21-7.1 | Must | As the owner, I want every sponsorship figure computed from the stored sponsors, sponsorships and applications, shared with the admin dashboard, and no write into other modules' stores, so that the figures are correct and the scope matches live. | FN-M21-7.1.1–7.1.6 |
| US-M21-23 | FT-M21-1.3 | Must | As any user, I want every M21 page usable at phone, tablet and desktop widths with readable text, so that I can use it anywhere. | FN-M21-1.3.5 |

### Acceptance criteria

**US-M21-01 — Menus and shells**
- **AC-M21-01.1** Given the admin at 1280px on S1, when the sidebar renders, then the group "Pengguna" is open with "Penajaan" → `/admin/sponsors` active, "Anak Angkat" → `/admin/anak-angkat` and "Permohonan" → `/admin/anak-angkat/permohonan` after M02's items; on S2 and S3 "Penajaan" is active; on S4 "Anak Angkat" is active; on S5 "Permohonan" is active.
- **AC-M21-01.2** Given the admin at 375px on S1, when the page renders, then the bottom nav shows "Penaja" → `/admin/sponsors`.
- **AC-M21-01.3** Given the admin on a user-portal page, when I open the user menu, then the group "💎 KILLER FEATURES" shows "Mohon Keluarga Angkat" → `/mohon-keluarga-angkat` between "Pembetulan" and "Penguasaan"; given pelajar (provisional), the entry is shown; given guru (provisional), it is not shown.
- **AC-M21-01.4** Given the admin, when S1–S5 load, then they render in the admin-panel shell; when S6 loads, then it renders in the user-portal shell and "LIVE:", "MAIN", "DAFTAR" are not visible; when S7 loads, then no sidebar, header or bottom nav renders.
- **AC-M21-01.5** Given a guest on the M01 register page, when I click "Daftar sebagai Penaja", then S7 opens at `/sponsor/register` with "Pendaftaran Penaja".

**US-M21-02 — Titles**
- **AC-M21-02.1** Given the admin, when S1, S2, S4 and S5 load, then the headers read "Pengurusan Penaja" / "Semak dan urus permohonan penaja", "Tambah Penaja Baru" / "Daftar penaja baru (auto-diluluskan)", "Anak Angkat — Sponsorship" / "Selamat datang, Admin", "Permohonan Keluarga Angkat" / "Selamat datang, Admin", and the tab titles "Urus Penaja - Admin", "Tambah Penaja - Admin", "Pengurusan Anak Angkat", "Permohonan Anak Angkat".
- **AC-M21-02.2** Given the admin, when S3 #6, S3 #11, S6 and S7 load, then S3 reads "Edit Penaja" / "Kedai Buku Popular" and "Edit Penaja" / "Alesa It Services" with the tab "Edit Penaja - Admin"; S6 reads "Mohon Keluarga Angkat" / "Selamat datang kembali" (not "Dashboard", DV-M21-06) with the tab "Mohon Keluarga Angkat"; S7 has the tab "Daftar Penaja - PRESTASIPLUS".

**US-M21-03 — Access**
- **AC-M21-03.1** Given no session, when I open `/admin/sponsors`, `/admin/sponsors/create`, `/admin/sponsors/6/edit`, `/admin/anak-angkat`, `/admin/anak-angkat/permohonan`, `/mohon-keluarga-angkat` or `/sponsor`, then I am sent to `/login`; when I open `/sponsor/register`, then S7 renders.
- **AC-M21-03.2** Given pelajar (provisional), when I open `/admin/sponsors`, `/admin/sponsors/6/edit`, `/admin/anak-angkat` or `/admin/anak-angkat/permohonan`, then I land on `/dashboard`; `GET /api/admin/sponsors` answers 403.
- **AC-M21-03.3** Given pelajar or ibubapa (provisional), when I open `/mohon-keluarga-angkat`, then S6 renders.
- **AC-M21-03.4** Given the admin, when I open `/sponsor`, `/sponsor/anak-angkat`, `/sponsor/anak-angkat/pool` or `/sponsor/rewards`, then the standalone 403 page shows "403", "🚫", "Akses Ditolak", "Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir.", "Halaman Utama" → `/`, "Log Masuk" → `/login`, with the tab "403 - Akses Ditolak | PRESTASIPLUS".
- **AC-M21-03.5** Given the admin (signed in), when I open `/sponsor/register`, then S7 renders without a redirect.

**US-M21-04 — Error pages**
- **AC-M21-04.1** Given the admin, when I open `/admin/sponsors/999999/edit`, `/admin/anak-angkat/permohonan/1` or each probed route of §1 (from `/admin/sponsors/999999` to `/mohon-keluarga-angkat/status`), then the global 404 page shows "404", "🔍", "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama", "Mula Latihan".
- **AC-M21-04.2** Given the admin, when I open `/admin/anak-angkat/2`, `/admin/anak-angkat/create`, `/admin/anak-angkat/pool`, `/admin/anak-angkat/sponsors` or `/sponsor/profile`, then the global 404 page shows and "Oops! An Error Occurred" is absent (DV-M21-02).
- **AC-M21-04.3** Given the admin on S1, when I click "Lihat" on row #11, then S3 of #11 opens at `/admin/sponsors/11/edit` and "Ralat Pelayan" is absent (DV-M21-01); when I open `/admin/sponsors/999999`, then the 404 page shows.

**US-M21-05 — Formats, labels, paging, loading**
- **AC-M21-05.1** Given the admin, then S1 rows read "31/03/2026" (#11) and "06/02/2026" (#6–#10), S3 #6 "Tarikh Daftar" "06/02/2026" and S4 row #2 "31/03/2026".
- **AC-M21-05.2** Given the admin, then S4 shows the badges "B40", "Direct", "Active" and the tabs "Graduated (0)", "Withdrawn (0)", "Expired (0)"; the S4 option "Via Agent"; S5 shows "Pending" and the applicant roles "student" / "parent"; the S4 row's sponsor line reads "Syarikat Swasta" and not "SYARIKAT_SWASTA"; the S3 strip reads "Digantung" and not "SUSPENDED", while the status card still reads "(SUSPENDED)" (DV-M21-08).
- **AC-M21-05.3** Given the seed, when S1, S4 and S5 load, then no pager shows; when I open `/admin/sponsors?page=2`, then "6 penaja dijumpai", the row "Tiada penaja dijumpai" and the pager "« Previous", "Next »", "Showing 0 of 6 results" and "1" show (DV-M21-04); given the test fixture `m21-many` (25 sponsors, provisional), S1 shows 20 rows and a pager whose page-2 link keeps `status=SUSPENDED` (PROPOSED size).
- **AC-M21-05.4** Given a mock latency of 2 s, when S1 loads, then the shell loading behaviour shows until the table renders; given a mock fault on the sponsor list API, then the M01 global error convention shows.

**US-M21-06 — Sponsor list**
- **AC-M21-06.1** Given the admin, when S1 loads, then the cards read "6" "Jumlah", "0" "Menunggu", "0" "Diluluskan", "0" "Ditolak", "6" "Digantung"; the count line reads "6 penaja dijumpai" with "Tambah Penaja" → S2; the filter card shows "Carian" (placeholder "Nama, email..."), "Status" ("Semua Status", Menunggu, Diluluskan, Ditolak, Digantung), "Kategori" ("Semua Kategori" + 13), "Cari" and no "Reset".
- **AC-M21-06.2** Given the admin, when S1 loads, then the table has the columns "#", "Organisasi", "Kategori", "Pegawai", "Status", "Tarikh", "Tindakan" and 6 rows in the order #11, #6, #7, #8, #9, #10; row #11 reads "Alesa It Services", "penaja@demo.test", "Syarikat Swasta", "Hafiz Bin Contoh", "0100000011", "Digantung", "31/03/2026"; row #6 reads "Kedai Buku Popular", "sponsor1@demo.test", "Syarikat Swasta", "-", "Digantung", "06/02/2026".
- **AC-M21-06.3** Given the admin, when I filter status "Digantung" (or open `?status=suspended`), then "6 penaja dijumpai" and 6 rows; "Menunggu", "Diluluskan" or "Ditolak" → "0 penaja dijumpai" and "Tiada penaja dijumpai"; category "Syarikat Swasta" → 6, "Individu / Peribadi" → 0; search "Kedai" → "1 penaja dijumpai" (#6); search "zzqxv" → 0; on every filter the cards still read 6 / 0 / 0 / 0 / 6, the values stay selected and "Reset" → `/admin/sponsors` shows.
- **AC-M21-06.4** Given the admin (provisional, INFERRED field), when I search "sponsor3", then 1 row (#8 "KidZania Kuala Lumpur") shows.

**US-M21-07 — Row actions**
- **AC-M21-07.1** Given the admin on S1, then row #6 "Edit" targets `/admin/sponsors/6/edit` and opens S3 #6; row #6 "Lihat" targets `/admin/sponsors/6` and opens S3 #6 (DV-M21-01).

**US-M21-08 — Add sponsor**
- **AC-M21-08.1** Given the admin, when S2 loads, then it shows "Kembali ke Senarai Penaja" → S1; "Maklumat Organisasi" with "Nama Organisasi *" (placeholder "cth: Kedai Buku Popular"), "Kategori *" (13 options, "Individu / Peribadi" first, no empty option), "Penerangan" ("Penerangan ringkas organisasi..."), "Tagline" ("cth: Membaca Jambatan Ilmu"), "Website" ("https://example.com"), "URL Logo" ("https://example.com/logo.png"), "No. Pendaftaran (SSM/ROC)"; "Maklumat Pegawai Perhubungan" with "Nama Pegawai", "Jawatan", "Email", "Telefon"; "Alamat" with "Alamat", "Bandar", "Negeri" (a text input), "Poskod"; the buttons "Tambah Penaja" and "Batal".
- **AC-M21-08.2** Given the admin on S2, when I submit with an empty "Nama Organisasi", or a website "abc", or a contact e-mail "abc", then nothing is created and the browser's required / type check stops the submit.
- **AC-M21-08.3** Given the admin on S2 (provisional), when I enter "Syarikat Contoh Sdn Bhd", choose "Syarikat Teknologi" and click "Tambah Penaja", then I land on S1 reading "7 penaja dijumpai", cards 7 / 0 / 1 / 0 / 6, with row #12 first ("Syarikat Contoh Sdn Bhd", no login e-mail, "Syarikat Teknologi", "-", "Diluluskan", "25/09/2026"); the S4 "Penaja" select lists "Syarikat Contoh Sdn Bhd"; the M17 dashboard reads "Jumlah Penaja" 7 and "1 Aktif".
- **AC-M21-08.4** Given the admin on S2, when I click "Batal" or "Kembali ke Senarai Penaja", then S1 opens and nothing is created.

**US-M21-09 — Edit sponsor**
- **AC-M21-09.1** Given the admin, when S3 #6 loads, then it shows "Kembali ke Senarai Penaja" → S1 and the three sections prefilled — "Kedai Buku Popular", "Syarikat Swasta" selected, the description "Rangkaian kedai buku terbesar Malaysia. Menyediakan buku-buku pendidikan berkualiti untuk semua peringkat umur.", website "https://www.popular.com.my", every other field empty — with no placeholder on any field; the strip reads "Digantung" "Status", "0" "Hadiah", "06/02/2026" "Tarikh Daftar"; the buttons "Kemaskini Penaja" and "Batal".
- **AC-M21-09.2** Given the admin, when S3 #11 loads, then it shows "Alesa It Services", "Syarikat IT", "https://alesa.my", officer "Hafiz Bin Contoh", "Pengurus", "pegawai.alesa@demo.test", "0100000011", address "No. 1, Jalan Contoh 1/1", "Shah Alam", "Selangor", "40000", and "31/03/2026" "Tarikh Daftar".
- **AC-M21-09.3** Given the admin on S3 #6 (provisional), when I set "Tagline" to "Membaca Jambatan Ilmu" and click "Kemaskini Penaja", then I land on S1 (no flash text) and S3 #6 shows the tagline; the status stays "Digantung" and S1 still reads 6 / 0 / 0 / 0 / 6.

**US-M21-10 — Sponsor status**
- **AC-M21-10.1** Given the admin, when S3 #6 loads, then the status card reads "Status Penaja:", "Digantung", "(SUSPENDED)" and "Aktifkan Semula"; when I click it, then the confirm "Aktifkan semula penaja ini?" shows; Cancel changes nothing.
- **AC-M21-10.2** Given the admin on S3 #6 (provisional), when I confirm "Aktifkan Semula", then S3 #6 reads "Diluluskan" "(APPROVED)" (pattern INFERRED) with no reactivate button; S1 reads 6 / 0 / 1 / 0 / 5 and row #6 "Diluluskan"; the S4 "Penaja" select lists "Kedai Buku Popular"; the M17 dashboard reads "0" → "1 Aktif" and "Digantung" 5.
- **AC-M21-10.3** Given a sponsor registered on S7 (AC-M21-19.2, provisional, PROPOSED), when the admin opens its S3, then the status card reads "Menunggu" "(PENDING)" (pattern INFERRED) with "Luluskan" and "Tolak"; "Luluskan" + confirm "Luluskan penaja ini?" → "Diluluskan" "(APPROVED)" and S1 7 / 0 / 1 / 0 / 6; on another pending sponsor "Tolak" + confirm "Tolak penaja ini?" → "Ditolak" "(REJECTED)" with no action.

**US-M21-11 — Anak angkat overview**
- **AC-M21-11.1** Given the admin, when S4 loads, then the cards read "Jumlah Penaja" "1", "Pelajar Aktif Ditaja" "1", "Graduated" "0", "Withdrawn" "0"; the tabs read "Semua (1)" (active, filled blue), "Aktif (1)", "Graduated (0)", "Withdrawn (0)", "Expired (0)".
- **AC-M21-11.2** Given the admin, when S4 loads, then the table has the columns "#", "Penaja", "Pelajar", "Kategori", "Saluran", "Status", "Tarikh", "Aksi" and one row: "2", "Alesa It Services" / "Syarikat Swasta", "Irfan Hakimi Bin Contoh" / "irfanhakimi@demo.test", "B40", "Direct", "Active", "31/03/2026", "Graduate", "Tarik".
- **AC-M21-11.3** Given the admin, when I click "Graduated", "Withdrawn" or "Expired", then the tab is active, the table shows "Tiada rekod", the cards still read 1 / 1 / 0 / 0 and "Semua (1)" is shown (DV-M21-03); when I click "Aktif", then row #2 shows.

**US-M21-12 — Assign**
- **AC-M21-12.1** Given the admin, when S4 loads, then "Assign Anak Angkat" shows "Penaja" with only "Pilih Penaja", "Cari Pelajar (nama/email)" with the placeholder "Taip nama atau email...", "Kategori" ("-", "B40", "Asnaf", "Yatim", "OKU"), "Saluran" ("Direct", "Via Agent") and the button "Assign".
- **AC-M21-12.2** Given the admin on S4 (provisional), when I type "H" in the search box, then no search request is made; when I type "Hajar" and wait 300 ms, then the dropdown lists a row with "Nur Hajar Binti Demo" (bold) and "nurhajar@demo.test · SMK Demo Seri Putra" (her school suffix, SOURCE-DERIVED row; at most 10 rows, PROPOSED), and a result without a school shows the e-mail only; when I click it, then the line "Nur Hajar Binti Demo (nurhajar@demo.test)" shows.
- **AC-M21-12.3** Given sponsor #6 reactivated (AC-M21-10.2, provisional), when I choose "Kedai Buku Popular", pick "Nur Hajar Binti Demo", choose "Yatim" and "Via Agent" and click "Assign", then S4 reads cards 2 / 2 / 0 / 0, tabs "Semua (2)", "Aktif (2)", and row #3 first: "Kedai Buku Popular" / "Syarikat Swasta", "Nur Hajar Binti Demo", "Yatim", "Via Agent", "Active", "25/09/2026".
- **AC-M21-12.4** Given the admin on S4, when I click "Assign" with "Pilih Penaja" selected, then the browser's required check stops the submit; given an approved sponsor (provisional), when I submit without picking a student, then nothing is created and the message of SRS §8.2 shows (PROPOSED COPY).

**US-M21-13 — Graduate and withdraw**
- **AC-M21-13.1** Given the admin on S4 (provisional), when I click "Graduate" on row #2, then no confirm shows; row #2 reads "Graduated" with no action; the cards read 1 / 0 / 1 / 0 and the tabs "Semua (1)", "Aktif (0)", "Graduated (1)".
- **AC-M21-13.2** Given the admin on S4 (provisional, fresh seed), when I click "Tarik" on row #2, then no confirm shows; row #2 reads "Withdrawn"; the cards read 1 / 0 / 0 / 1 and the tabs "Aktif (0)", "Withdrawn (1)".

**US-M21-14 — Applications**
- **AC-M21-14.1** Given the admin, when S5 loads, then the tab cards read "Menunggu 3" (current), "Dalam Pool 0", "Ditaja 0", "Ditolak 0"; the table has the columns "#", "Pelajar", "Pemohon", "Kategori", "Sebab", "Status", "Aksi" and the rows #3, #2, #1.
- **AC-M21-14.2** Given the admin, when S5 loads, then row #1 reads "Nur Hajar Binti Demo", "nurhajar@demo.test", her school name, applicant "Nur Hajar Binti Demo" "student", "B40", "• Pelajar yatim piatu yang tinggal bersama nenek. Nenek sudah tua dan tiada pend...", "Pending", "Lulus", "Tolak"; row #2 reads "Aina Sofea Binti Demo", "-" (no school), applicant "Rosnah Binti Demo" "parent"; row #3 reads "Adam Haikal Bin Demo", "-", applicant "Rosnah Binti Demo" "parent"; the reasons of #2 and #3 are the same text cut at 80 characters with "...".
- **AC-M21-14.3** Given the admin, when I open the tabs "Dalam Pool", "Ditaja" and "Ditolak", then the table shows "Tiada permohonan dalam pool", "Tiada permohonan ditaja" and "Tiada permohonan ditolak" (DV-M21-08) and the tab counts stay 3 / 0 / 0 / 0.
- **AC-M21-14.4** Given applications in the statuses `approved`, `matched` and `rejected` (after AC-M21-15.1, AC-M21-21.2 and AC-M21-15.2; provisional, INFERRED badges), when the admin opens the tabs "Dalam Pool", "Ditaja" and "Ditolak", then each row shows the badge "Approved", "Matched" or "Rejected" respectively and no "Lulus" / "Tolak" action.

**US-M21-15 — Approve and reject applications**
- **AC-M21-15.1** Given the admin on S5 (provisional), when I click "Lulus" on row #1, then no confirm shows; the tabs read "Menunggu 2", "Dalam Pool 1"; the "Dalam Pool" tab lists #1 with the badge "Approved" and no action.
- **AC-M21-15.2** Given the admin on S5, when I click "Tolak" on row #3, then the confirm "Tolak permohonan ini?" shows; Cancel changes nothing; OK (provisional) → "Menunggu 2", "Ditolak 1" and #3 listed under "Ditolak" with "Rejected" and no action.

**US-M21-16 — Application form**
- **AC-M21-16.1** Given the admin, when S6 loads, then it shows the H1 "Mohon Keluarga Angkat", "Isi borang ini untuk memohon tajaan akses PrestasiPlus secara percuma.", "Email Pelajar" (placeholder "pelajar@email.com") with the hint and the link "sini" → `/register`, "Kategori Pelajar" ("Pilih kategori" + the 5 labelled options), "Anggaran Pendapatan Keluarga" ("Pilih (pilihan)" + 4 ranges), "Sebab Permohonan" (placeholder "Terangkan kenapa pelajar ini memerlukan tajaan...").
- **AC-M21-16.2** Given S6, then "Contoh sebab permohonan:" lists the 5 examples; when I click example 2, then the textarea value equals "• Pelajar yatim piatu yang tinggal bersama nenek. Nenek sudah tua dan tiada pendapatan tetap. Pelajar ini berpotensi tetapi tiada akses kepada bahan pembelajaran digital." (with the bullet) and no request is made; clicking example 4 replaces it.
- **AC-M21-16.3** Given S6, then the note "Klik mana-mana contoh untuk guna sebagai template. Sila ubahsuai mengikut situasi sebenar.", the button "Hantar Permohonan", "Apa yang berlaku selepas mohon?" with its 4 steps and "Siapa boleh mohon?" with "Pelajar sendiri — mohon untuk diri sendiri", "Ibu bapa — mohon untuk anak", "Guru / Kaunselor — mohon untuk pelajar yang dikenal pasti memerlukan" show.

**US-M21-17 — Submit an application**
- **AC-M21-17.1** Given S6, when I click "Hantar Permohonan" with an empty e-mail, no category or an empty reason, or the e-mail "abc", then nothing is created and the browser's required / type check stops the submit.
- **AC-M21-17.2** Given pelajar (provisional), when I submit "pelajar@demo.test", "OKU — Orang kurang upaya", "Bawah RM1,000" and a reason, then S6 shows the PROPOSED success notice with an empty form; the admin's S5 reads "Menunggu 4" with row #4 first (applicant role "student", "OKU").
- **AC-M21-17.3** Given pelajar (provisional), when I submit "tiada.pelajar@demo.test" or "guru@demo.test" (not a student), then the form returns with the PROPOSED e-mail message and nothing is created.
- **AC-M21-17.4** Given ibubapa (provisional), when I submit "pelajar2@demo.test", "B40 — Pendapatan rendah" and a reason, then S5 lists the new row with applicant "parent".

**US-M21-18 — Registration page**
- **AC-M21-18.1** Given a guest, when S7 loads, then it shows "PRESTASIPLUS", "Pendaftaran Penaja", the pills "Organisasi", "Hubungan", "Akaun", step 1 "Maklumat Organisasi" with its fields and placeholders and the 13 category tiles with their icons; when I click "Seterusnya" with no tile selected, then the alert "Sila pilih kategori penaja." shows and step 1 stays; after selecting "Koperasi", "Seterusnya" opens step 2 and the first bar turns green.
- **AC-M21-18.2** Given step 2, then it shows "Maklumat Hubungan & Alamat" with its 8 fields and placeholders and "Negeri *" ("Pilih negeri" + 16 states); "Kembali" returns to step 1 with the typed values kept; "Seterusnya" with every field empty opens step 3.
- **AC-M21-18.3** Given step 3, then it shows "Akaun Log Masuk", "Nama Penuh Anda *", "E-mel Log Masuk *", "Kata Laluan *", "Sahkan Kata Laluan *", the note text, "Kembali" and "Hantar Permohonan"; clicking an eye button shows the password as text and switches the icon to `fa-eye-slash`; clicking again hides it.
- **AC-M21-18.4** Given S7, then the footer reads, in this order, "Sudah ada akaun?" "Log Masuk" → `/login` " · " "Daftar Sebagai Pelajar" → `/register`, then "Kembali ke Laman Utama" → `/`.

**US-M21-19 — Submit a registration**
- **AC-M21-19.1** Given a guest on step 3 (provisional), when I submit with step 2 empty, then no account or sponsor is created (browser required check, INFERRED).
- **AC-M21-19.2** Given a guest (provisional), when I complete the three steps for "Syarikat Ujian Demo" ("Syarikat Teknologi", officer "Pegawai Ujian", "ujian.pegawai@demo.test", "0100000099", "No. 2, Jalan Contoh", "Kluang", "Johor", "86000", login "Penaja Ujian", "penaja.ujian@demo.test", password "rahsia123" twice) and click "Hantar Permohonan", then "Menghantar..." shows while pending and the PROPOSED success panel with "Log Masuk" replaces the card; the admin's S1 reads 7 / 1 / 0 / 0 / 6 with the row "Syarikat Ujian Demo", "penaja.ujian@demo.test", "Pegawai Ujian", "Menunggu", "25/09/2026"; M02 `?role=sponsor` lists 7 users.
- **AC-M21-19.3** Given a guest (provisional), when I submit with the login e-mail "penaja@demo.test", then the PROPOSED "e-mail already registered" message shows on step 3 and nothing is created.
- **AC-M21-19.4** Given a guest (provisional), when I submit a 5-character password or two different passwords, then the PROPOSED password message shows and nothing is created.

**US-M21-20 — Sponsor portal access (PROPOSED)**
- **AC-M21-20.1** Given `penaja@demo.test` (sponsor #11, suspended; provisional), when I sign in and open `/sponsor`, then the 403 page "Akses Ditolak" shows.
- **AC-M21-20.2** Given the sponsor of AC-M21-19.2 approved by the admin (provisional), when it signs in, then it lands on `/sponsor/anak-angkat` (via `/sponsor`); `/sponsor/rewards` redirects to `/sponsor/anak-angkat`; `/sponsor/profile` shows the 404 page.

**US-M21-21 — Sponsor portal lists (PROPOSED)**
- **AC-M21-21.1** Given the approved sponsor of AC-M21-20.2 (provisional), when it opens `/sponsor/anak-angkat`, then "Anak Angkat Saya" shows "Tiada rekod"; when it opens `/sponsor/anak-angkat/pool`, then "Pool Pelajar" shows "Tiada pelajar dalam pool".
- **AC-M21-21.2** Given the admin approved application #1 (AC-M21-15.1, provisional), when the sponsor opens the pool, then #1 "Nur Hajar Binti Demo" "B40" with the truncated reason and "Taja" shows; "Taja" + confirm "Taja pelajar ini?" → the sponsor lands on "Anak Angkat Saya" listing her with "B40", "Active"; the admin's S5 reads "Dalam Pool 0", "Ditaja 1"; S4 reads cards 2 / 2 / 0 / 0 with a new row "Syarikat Ujian Demo", "Direct", "Active".

**US-M21-22 — Data rules and boundaries**
- **AC-M21-22.1** Given the project clock, then the stores hold exactly 6 sponsors (ids 6–11, all `SYARIKAT_SWASTA`, all `SUSPENDED`), 1 anak-angkat record (#2, sponsor 11, `active`, `direct`, `B40`) and 3 applications (#1–#3, all `pending`, `B40`).
- **AC-M21-22.2** Given the admin, when the M17 dashboard loads, then its sponsor cards read "Jumlah Penaja" 6 / "0 Aktif", "Menunggu Kelulusan" 0, "Ditolak" 0, "Digantung" 6 from M21's contract; M02 `/admin/users?role=sponsor` lists 6 users, each the login of one sponsor 6–11.
- **AC-M21-22.3** Given the admin, then S1 "Jumlah" reads 6 while S4 "Jumlah Penaja" reads 1 (sponsors with an anak-angkat record); after AC-M21-12.3 (provisional) S4 "Jumlah Penaja" reads 2 and S1 "Jumlah" still 6.
- **AC-M21-22.4** Given the admin, then S3 "Hadiah" reads "0" on all 6 sponsors; after an assign (AC-M21-12.3) the student's M19 entitlement is unchanged and no M19 payment is created (provisional).
- **AC-M21-22.5** Given the transition rules (provisional, INFERRED / PROPOSED), when "Aktifkan Semula" is requested for an `APPROVED` sponsor, "Lulus" for a `rejected` application, "Graduate" for a `graduated` record or "Taja" for a `pending` application, then the API answers `409 INVALID_STATE` and nothing changes; given the seed, anak angkat #2 stays "Active" while its sponsor #11 is "Digantung".

**US-M21-23 — Responsive**
- **AC-M21-23.1** Given each of S1–S7 (every S7 step), S3 #6 and S3 #11, and the PROPOSED portal pages at 375, 768 and 1280px, when it loads, then the page has no horizontal scroll (`scrollWidth ≤ clientWidth`; live S3 409 and S4 397 at 375 are fixed, DV-M21-05) and no content text is below 12px (DV-M21-07).
- **AC-M21-23.2** Given the admin, then S1 stats have 2 / 5 / 5 columns; the S2 / S3 form grids 1 / 2 / 2 and the address grid 1 / 3 / 3; S4 stats 2 / 4 / 4; S5 tab cards 2 / 4 / 4; S7 tiles 2 / 3 / 3 and the H1 24 / 48 / 48 px; S6 a single centred column at every width; the S1, S4 and S5 tables scroll inside their cards where they are wider than the card (375 / 768 / 1280).

---

## 5. UI expectations

| Screen | Key states (screenshots in `docs/discovery/img/M21/`) | Behaviour notes (per-width detail in SRS §10) |
|---|---|---|
| S1 | default, filters, empty, page 2 (`admin-sponsors-desktop/-tablet/-mobile.png`, `admin-sponsors-empty.png`, `admin-sponsors-page-2.png`) | stats 2 / 5 / 5; table in a scrolling card; table text ≥ 12 px (DV-M21-07). |
| S2 | default (`admin-sponsor-create-*.png`) | 1 column at 375, 2 from 768; address 3 from 768. |
| S3 | #6, #11, 404, "Lihat" → S3 (`admin-sponsor-edit-*.png`; live `admin-sponsor-show-500.png`) | as S2; status card wraps at 375 (DV-M21-05). |
| S4 | default, tabs, empty, 405 → 404 (`admin-anak-angkat-*.png`) | stats 2 / 4 / 4; tabs wrap at 375 (DV-M21-05); table scrolls in its card; badges ≥ 12 px. |
| S5 | default, tabs, empty, 404 (`admin-permohonan-*.png`) | tab cards 2 / 4 / 4; table scrolls in its card at 375 / 768. |
| S6 | default, example clicked (`mohon-keluarga-angkat-*.png`) | single centred column; note ≥ 12 px; header title fixed (DV-M21-06). |
| S7 | step 1, tile, step 2, step 3, eye (`sponsor-register-*.png`) | tiles 2 / 3 / 3; H1 24 / 48 / 48 px; tile labels ≥ 12 px at 375. |
| Portal (PROPOSED) | my list, pool, empty | user-portal shell; table in a scrolling card; no horizontal page scroll. |

Loading: every data view shows the shared shell loading behaviour while the mock responds (M01 convention; live pages are server-rendered). A mock failure uses the global error convention of M01; confirms are the browser `confirm()` dialogs as live.

---

## 6. Coverage matrix (completeness proof)

Source: `docs/discovery/inventory/M21/` (generated 2026-09-27; 7 screens, 55 captured states). Compiled from the inventory JSON element by element; `coverage.cjs` in the writer's scratchpad `m21-writer/` re-checks it (every inventory id has exactly one row; every "Covered by" is an existing Function or an exclusion). Every M21 content element (S1–S7) is listed with the Function that covers it or with a concrete exclusion reason. The two shells (SHA, SHU) are chrome owned by the global shell (design/shells.md, M23 and the owning modules): **all their elements are excluded**, and the 16 of them that render an M21 menu entry or an M21 header title name the Function that specifies it (FN-M21-1.1.1–1.1.3). "Content" quotes the DOM text as captured (`<person>`, `<name>` = discovery masks, including the over-masked organisation / copy cells noted in discovery §0; row lists are sampled, discovery `meta.repeats`).

**Summary**

| Set | Elements | Mapped to an M21 Function | Excluded (with reason) | Unmapped |
|---|---|---|---|---|
| S1 — `/admin/sponsors` | 46 | 46 | 0 | 0 |
| S2 — `/admin/sponsors/create` | 38 | 38 | 0 | 0 |
| S3 — `/admin/sponsors/{id}/edit` | 64 | 64 | 0 | 0 |
| S4 — `/admin/anak-angkat` | 50 | 50 | 0 | 0 |
| S5 — `/admin/anak-angkat/permohonan` | 37 | 37 | 0 | 0 |
| S6 — `/mohon-keluarga-angkat` | 38 | 35 | 3 | 0 |
| S7 — `/sponsor/register` | 72 | 72 | 0 | 0 |
| **M21 content (S1–S7)** | **345** | **342** | **3** (M16 tournament banner "LIVE:", "MAIN", "DAFTAR" on the user-shell screen S6, EL S6-001–003) | **0** |
| SHA — admin-panel shell (chrome of S1–S5) | 217 | 0 | 217 (global shell chrome; 13 of them render an M21 menu entry or header title that FN-M21-1.1.1 / 1.1.3 specify) | 0 |
| SHU — user-portal shell (chrome of S6) | 372 | 0 | 372 (global shell chrome; 3 of them render an M21 menu entry or header title that FN-M21-1.1.2 / 1.1.3 specify) | 0 |

**345/345 M21 content elements covered (342 mapped, 3 excluded with reason), 0 unmapped.** Including the shells: 934/934 elements accounted for (342 mapped, 592 excluded with reason), 0 unmapped. 41 of the 79 Functions appear in this matrix; the other 38 are behaviour-only Functions (shell entries rendered by the global shell, access rules, formats, data rules, unobservable or PROPOSED states).

### 6.1 M21 content elements

#### S1 — `/admin/sponsors` (46 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M21-S1-001 | card | visible-default | "6" (card "Jumlah") | FN-M21-2.1.1 |
| EL-M21-S1-002 | text | visible-default | "6" | FN-M21-2.1.1 |
| EL-M21-S1-003 | text | visible-default | "Jumlah" | FN-M21-2.1.1 |
| EL-M21-S1-004 | card | visible-default | "0" (card "Menunggu") | FN-M21-2.1.1 |
| EL-M21-S1-005 | text | visible-default | "0" | FN-M21-2.1.1 |
| EL-M21-S1-006 | text | visible-default | "Menunggu" | FN-M21-2.1.1 |
| EL-M21-S1-007 | card | visible-default | "0" (card "Diluluskan") | FN-M21-2.1.1 |
| EL-M21-S1-008 | text | visible-default | "0" | FN-M21-2.1.1 |
| EL-M21-S1-009 | text | visible-default | "Diluluskan" | FN-M21-2.1.1 |
| EL-M21-S1-010 | card | visible-default | "0" (card "Ditolak") | FN-M21-2.1.1 |
| EL-M21-S1-011 | text | visible-default | "0" | FN-M21-2.1.1 |
| EL-M21-S1-012 | text | visible-default | "Ditolak" | FN-M21-2.1.1 |
| EL-M21-S1-013 | card | visible-default | "6" (card "Digantung") | FN-M21-2.1.1 |
| EL-M21-S1-014 | text | visible-default | "6" | FN-M21-2.1.1 |
| EL-M21-S1-015 | text | visible-default | "Digantung" | FN-M21-2.1.1 |
| EL-M21-S1-016 | text | visible-default | "6 penaja dijumpai" | FN-M21-2.1.2 |
| EL-M21-S1-017 | link | visible-default | "Tambah Penaja", → /admin/sponsors/create, fa-plus-circle | FN-M21-2.1.2 |
| EL-M21-S1-018 | card | visible-default | "Carian" (filter card) | FN-M21-2.1.3 |
| EL-M21-S1-019 | form | visible-default | GET → /admin/sponsors | FN-M21-2.1.3 |
| EL-M21-S1-020 | label | visible-default | "Carian" | FN-M21-2.1.3 |
| EL-M21-S1-021 | input | visible-default | text, name=search, placeholder "Nama, email..." | FN-M21-2.1.3 |
| EL-M21-S1-022 | label | visible-default | "Status" | FN-M21-2.1.3 |
| EL-M21-S1-023 | select | visible-default | name=status: "" "Semua Status", PENDING "Menunggu", APPROVED "Diluluskan", REJECTED "Ditolak", SUSPENDED "Digantung" | FN-M21-2.1.3 |
| EL-M21-S1-024 | label | visible-default | "Kategori" | FN-M21-2.1.3 |
| EL-M21-S1-025 | select | visible-default | name=category: "" "Semua Kategori" + the 13 categories (INDIVIDU "Individu / Peribadi" … PENDIDIKAN "Penyedia Pendidikan") | FN-M21-2.1.3 |
| EL-M21-S1-026 | button | visible-default | submit "Cari", fa-search | FN-M21-2.1.3 |
| EL-M21-S1-027 | card | visible-default | "#" (table card) | FN-M21-2.1.5 |
| EL-M21-S1-028 | table | visible-default | columns "#", "Organisasi", "Kategori", "Pegawai", "Status", "Tarikh", "Tindakan"; 6 rows (#11, #6–#10) | FN-M21-2.1.5 |
| EL-M21-S1-029 | badge | visible-default | "Digantung", fa-ban (row #11) | FN-M21-2.1.5 |
| EL-M21-S1-030 | link | visible-default | "Lihat", → /admin/sponsors/11, fa-eye | FN-M21-2.1.6 |
| EL-M21-S1-031 | link | visible-default | "Edit", → /admin/sponsors/11/edit, fa-edit | FN-M21-2.1.6 |
| EL-M21-S1-032 | badge | visible-default | "Digantung", fa-ban (row #6) | FN-M21-2.1.5 |
| EL-M21-S1-033 | link | visible-default | "Lihat", → /admin/sponsors/6, fa-eye | FN-M21-2.1.6 |
| EL-M21-S1-034 | link | visible-default | "Edit", → /admin/sponsors/6/edit, fa-edit | FN-M21-2.1.6 |
| EL-M21-S1-035 | badge | visible-default | "Digantung", fa-ban (row #7) | FN-M21-2.1.5 |
| EL-M21-S1-036 | link | visible-default | "Lihat", → /admin/sponsors/7, fa-eye | FN-M21-2.1.6 |
| EL-M21-S1-037 | link | visible-default | "Edit", → /admin/sponsors/7/edit, fa-edit | FN-M21-2.1.6 |
| EL-M21-S1-038 | text | conditional | "0 penaja dijumpai" | FN-M21-2.1.2 |
| EL-M21-S1-039 | link | conditional | "Reset", → /admin/sponsors, fa-times | FN-M21-2.1.3 |
| EL-M21-S1-040 | pagination | hidden-only | "« Previous", → ?page=1 | FN-M21-1.3.3 |
| EL-M21-S1-041 | text | hidden-only | "Next »" | FN-M21-1.3.3 |
| EL-M21-S1-042 | text | conditional | "Showing 0 of results" | FN-M21-1.3.3 |
| EL-M21-S1-043 | text | conditional | "6" (pager total) | FN-M21-1.3.3 |
| EL-M21-S1-044 | pagination | conditional | previous-arrow link (svg icon), → ?page=1 | FN-M21-1.3.3 |
| EL-M21-S1-045 | pagination | conditional | "1", → ?page=1 | FN-M21-1.3.3 |
| EL-M21-S1-046 | text | conditional | "1 penaja dijumpai" | FN-M21-2.1.2 |

#### S2 — `/admin/sponsors/create` (38 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M21-S2-001 | link | visible-default | "Kembali ke Senarai Penaja", → /admin/sponsors, fa-arrow-left | FN-M21-2.2.1 |
| EL-M21-S2-002 | form | visible-default | POST → /admin/sponsors | FN-M21-2.2.1 |
| EL-M21-S2-003 | hidden-field | hidden-only | hidden, name=_token | FN-M21-2.2.1 |
| EL-M21-S2-004 | heading | visible-default | "Maklumat Organisasi" | FN-M21-2.2.2 |
| EL-M21-S2-005 | label | visible-default | "Nama Organisasi *" | FN-M21-2.2.2 |
| EL-M21-S2-006 | input | visible-default | text, name=name, placeholder "cth: Kedai Buku Popular", required | FN-M21-2.2.2 |
| EL-M21-S2-007 | label | visible-default | "Kategori *" | FN-M21-2.2.2 |
| EL-M21-S2-008 | select | visible-default | name=category, required: the 13 categories, first "Individu / Peribadi", no empty option | FN-M21-2.2.2 |
| EL-M21-S2-009 | label | visible-default | "Penerangan" | FN-M21-2.2.2 |
| EL-M21-S2-010 | textarea | visible-default | name=description, placeholder "Penerangan ringkas organisasi..." | FN-M21-2.2.2 |
| EL-M21-S2-011 | label | visible-default | "Tagline" | FN-M21-2.2.2 |
| EL-M21-S2-012 | input | visible-default | text, name=tagline, placeholder "cth: Membaca Jambatan Ilmu" | FN-M21-2.2.2 |
| EL-M21-S2-013 | label | visible-default | "Website" | FN-M21-2.2.2 |
| EL-M21-S2-014 | input | visible-default | url, name=website, placeholder "https://example.com" | FN-M21-2.2.2 |
| EL-M21-S2-015 | label | visible-default | "URL Logo" | FN-M21-2.2.2 |
| EL-M21-S2-016 | input | visible-default | text, name=logo_url, placeholder "https://example.com/logo.png" | FN-M21-2.2.2 |
| EL-M21-S2-017 | label | visible-default | "No. Pendaftaran (SSM/ROC)" | FN-M21-2.2.2 |
| EL-M21-S2-018 | input | visible-default | text, name=registration_number | FN-M21-2.2.2 |
| EL-M21-S2-019 | heading | visible-default | "Maklumat Pegawai Perhubungan" | FN-M21-2.2.3 |
| EL-M21-S2-020 | label | visible-default | "Nama Pegawai" | FN-M21-2.2.3 |
| EL-M21-S2-021 | input | visible-default | text, name=contact_person_name | FN-M21-2.2.3 |
| EL-M21-S2-022 | label | visible-default | "Jawatan" | FN-M21-2.2.3 |
| EL-M21-S2-023 | input | visible-default | text, name=contact_person_position | FN-M21-2.2.3 |
| EL-M21-S2-024 | label | visible-default | "Email" | FN-M21-2.2.3 |
| EL-M21-S2-025 | input | visible-default | email, name=contact_email | FN-M21-2.2.3 |
| EL-M21-S2-026 | label | visible-default | "Telefon" | FN-M21-2.2.3 |
| EL-M21-S2-027 | input | visible-default | text, name=contact_phone | FN-M21-2.2.3 |
| EL-M21-S2-028 | heading | visible-default | "Alamat" | FN-M21-2.2.4 |
| EL-M21-S2-029 | label | visible-default | "Alamat" | FN-M21-2.2.4 |
| EL-M21-S2-030 | input | visible-default | text, name=address | FN-M21-2.2.4 |
| EL-M21-S2-031 | label | visible-default | "Bandar" | FN-M21-2.2.4 |
| EL-M21-S2-032 | input | visible-default | text, name=city | FN-M21-2.2.4 |
| EL-M21-S2-033 | label | visible-default | "Negeri" | FN-M21-2.2.4 |
| EL-M21-S2-034 | input | visible-default | text, name=state (free text) | FN-M21-2.2.4 |
| EL-M21-S2-035 | label | visible-default | "Poskod" | FN-M21-2.2.4 |
| EL-M21-S2-036 | input | visible-default | text, name=postcode | FN-M21-2.2.4 |
| EL-M21-S2-037 | button | visible-default | submit "Tambah Penaja", fa-plus-circle | FN-M21-2.2.5 |
| EL-M21-S2-038 | link | visible-default | "Batal", → /admin/sponsors | FN-M21-2.2.5 |

#### S3 — `/admin/sponsors/{id}/edit` (64 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M21-S3-001 | link | visible-default | "Kembali ke Senarai Penaja", → /admin/sponsors, fa-arrow-left | FN-M21-2.3.1 |
| EL-M21-S3-002 | form | visible-default | POST → /admin/sponsors/6 | FN-M21-2.3.1 |
| EL-M21-S3-003 | hidden-field | hidden-only | hidden, name=_token | FN-M21-2.3.1 |
| EL-M21-S3-004 | hidden-field | hidden-only | hidden, name=_method (PUT) | FN-M21-2.3.1 |
| EL-M21-S3-005 | heading | visible-default | "Maklumat Organisasi" | FN-M21-2.3.1 |
| EL-M21-S3-006 | label | visible-default | "Nama Organisasi *" | FN-M21-2.3.1 |
| EL-M21-S3-007 | input | visible-default | text, name=name (value = organisation name; blanked by the discovery sanitizer) | FN-M21-2.3.1 |
| EL-M21-S3-008 | label | visible-default | "Kategori *" | FN-M21-2.3.1 |
| EL-M21-S3-009 | select | visible-default | name=category, the 13 categories, SYARIKAT_SWASTA selected | FN-M21-2.3.1 |
| EL-M21-S3-010 | label | visible-default | "Penerangan" | FN-M21-2.3.1 |
| EL-M21-S3-011 | textarea | visible-default | name=description (prefilled) | FN-M21-2.3.1 |
| EL-M21-S3-012 | label | visible-default | "Tagline" | FN-M21-2.3.1 |
| EL-M21-S3-013 | input | visible-default | text, name=tagline | FN-M21-2.3.1 |
| EL-M21-S3-014 | label | visible-default | "Website" | FN-M21-2.3.1 |
| EL-M21-S3-015 | input | visible-default | url, name=website (prefilled) | FN-M21-2.3.1 |
| EL-M21-S3-016 | label | visible-default | "URL Logo" | FN-M21-2.3.1 |
| EL-M21-S3-017 | input | visible-default | text, name=logo_url | FN-M21-2.3.1 |
| EL-M21-S3-018 | label | visible-default | "No. Pendaftaran (SSM/ROC)" | FN-M21-2.3.1 |
| EL-M21-S3-019 | input | visible-default | text, name=registration_number | FN-M21-2.3.1 |
| EL-M21-S3-020 | heading | visible-default | "Maklumat Pegawai Perhubungan" | FN-M21-2.3.1 |
| EL-M21-S3-021 | label | visible-default | "Nama Pegawai" | FN-M21-2.3.1 |
| EL-M21-S3-022 | input | visible-default | text, name=contact_person_name | FN-M21-2.3.1 |
| EL-M21-S3-023 | label | visible-default | "Jawatan" | FN-M21-2.3.1 |
| EL-M21-S3-024 | input | visible-default | text, name=contact_person_position | FN-M21-2.3.1 |
| EL-M21-S3-025 | label | visible-default | "Email" | FN-M21-2.3.1 |
| EL-M21-S3-026 | input | visible-default | email, name=contact_email | FN-M21-2.3.1 |
| EL-M21-S3-027 | label | visible-default | "Telefon" | FN-M21-2.3.1 |
| EL-M21-S3-028 | input | visible-default | text, name=contact_phone | FN-M21-2.3.1 |
| EL-M21-S3-029 | heading | visible-default | "Alamat" | FN-M21-2.3.1 |
| EL-M21-S3-030 | label | visible-default | "Alamat" | FN-M21-2.3.1 |
| EL-M21-S3-031 | input | visible-default | text, name=address | FN-M21-2.3.1 |
| EL-M21-S3-032 | label | visible-default | "Bandar" | FN-M21-2.3.1 |
| EL-M21-S3-033 | input | visible-default | text, name=city | FN-M21-2.3.1 |
| EL-M21-S3-034 | label | visible-default | "Negeri" | FN-M21-2.3.1 |
| EL-M21-S3-035 | input | visible-default | text, name=state | FN-M21-2.3.1 |
| EL-M21-S3-036 | label | visible-default | "Poskod" | FN-M21-2.3.1 |
| EL-M21-S3-037 | input | visible-default | text, name=postcode | FN-M21-2.3.1 |
| EL-M21-S3-038 | text | visible-default | "SUSPENDED" (strip status; → "Digantung", DV-M21-08) | FN-M21-2.3.2 |
| EL-M21-S3-039 | text | visible-default | "Status" | FN-M21-2.3.2 |
| EL-M21-S3-040 | text | visible-default | "0" (Hadiah) | FN-M21-2.3.2 |
| EL-M21-S3-041 | text | visible-default | "Hadiah" | FN-M21-2.3.2 |
| EL-M21-S3-042 | text | visible-default | "06/02/2026" | FN-M21-2.3.2 |
| EL-M21-S3-043 | text | visible-default | "Tarikh Daftar" | FN-M21-2.3.2 |
| EL-M21-S3-044 | button | visible-default | submit "Kemaskini Penaja", fa-save | FN-M21-2.3.3 |
| EL-M21-S3-045 | link | visible-default | "Batal", → /admin/sponsors | FN-M21-2.3.3 |
| EL-M21-S3-046 | card | visible-default | "Status Penaja:" (status card; blue fa-toggle-on icon first) | FN-M21-2.3.4 |
| EL-M21-S3-047 | text | visible-default | "Status Penaja:" | FN-M21-2.3.4 |
| EL-M21-S3-048 | text | visible-default | "Digantung" | FN-M21-2.3.4 |
| EL-M21-S3-049 | text | visible-default | "(SUSPENDED)" | FN-M21-2.3.4 |
| EL-M21-S3-050 | form | visible-default | POST → /admin/sponsors/6/reactivate, confirm "Aktifkan semula penaja ini?" | FN-M21-2.3.4 |
| EL-M21-S3-051 | hidden-field | hidden-only | hidden, name=_token | FN-M21-2.3.4 |
| EL-M21-S3-052 | button | visible-default | submit "Aktifkan Semula", fa-play-circle | FN-M21-2.3.4 |
| EL-M21-S3-053 | text | conditional | "404" | FN-M21-1.2.5 |
| EL-M21-S3-054 | text | conditional | "🔍" | FN-M21-1.2.5 |
| EL-M21-S3-055 | heading | conditional | "Halaman Tidak Dijumpai" | FN-M21-1.2.5 |
| EL-M21-S3-056 | text | conditional | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?" | FN-M21-1.2.5 |
| EL-M21-S3-057 | link | conditional | "Halaman Utama", → / (404 and 500 pages) | FN-M21-1.2.5 |
| EL-M21-S3-058 | link | conditional | "Mula Latihan", → /latih-tubi | FN-M21-1.2.5 |
| EL-M21-S3-059 | text | conditional | "PRESTASIPLUS" | FN-M21-1.2.5 |
| EL-M21-S3-060 | text | conditional | "⚙️" (500 page, live "Lihat") | FN-M21-1.2.7 |
| EL-M21-S3-061 | heading | conditional | "Ralat Pelayan" | FN-M21-1.2.7 |
| EL-M21-S3-062 | text | conditional | "Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar lagi." | FN-M21-1.2.7 |
| EL-M21-S3-063 | link | conditional | "Cuba Semula", → javascript:location.reload() | FN-M21-1.2.7 |
| EL-M21-S3-064 | text | conditional | "31/03/2026" (#11 Tarikh Daftar) | FN-M21-2.3.2 |

#### S4 — `/admin/anak-angkat` (50 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M21-S4-001 | card | visible-default | "Jumlah Penaja" | FN-M21-3.1.1 |
| EL-M21-S4-002 | text | visible-default | "Jumlah Penaja" | FN-M21-3.1.1 |
| EL-M21-S4-003 | text | visible-default | "1" | FN-M21-3.1.1 |
| EL-M21-S4-004 | card | visible-default | "Pelajar Aktif Ditaja" | FN-M21-3.1.1 |
| EL-M21-S4-005 | text | visible-default | "Pelajar Aktif Ditaja" | FN-M21-3.1.1 |
| EL-M21-S4-006 | text | visible-default | "1" | FN-M21-3.1.1 |
| EL-M21-S4-007 | card | visible-default | "Graduated" | FN-M21-3.1.1 |
| EL-M21-S4-008 | text | visible-default | "Graduated" | FN-M21-3.1.1 |
| EL-M21-S4-009 | text | visible-default | "0" | FN-M21-3.1.1 |
| EL-M21-S4-010 | card | visible-default | "Withdrawn" | FN-M21-3.1.1 |
| EL-M21-S4-011 | text | visible-default | "Withdrawn" | FN-M21-3.1.1 |
| EL-M21-S4-012 | text | visible-default | "0" | FN-M21-3.1.1 |
| EL-M21-S4-013 | card | visible-default | "Assign Anak Angkat" | FN-M21-3.1.2 |
| EL-M21-S4-014 | heading | visible-default | "Assign Anak Angkat" (fa-user-plus) | FN-M21-3.1.2 |
| EL-M21-S4-015 | form | visible-default | POST → /admin/anak-angkat/assign | FN-M21-3.1.2 |
| EL-M21-S4-016 | hidden-field | hidden-only | hidden, name=_token | FN-M21-3.1.2 |
| EL-M21-S4-017 | label | visible-default | "Penaja" | FN-M21-3.1.2 |
| EL-M21-S4-018 | select | visible-default | name=sponsor_id, required: "" "Pilih Penaja" only | FN-M21-3.1.2 |
| EL-M21-S4-019 | label | visible-default | "Cari Pelajar (nama/email)" | FN-M21-3.1.3 |
| EL-M21-S4-020 | input | visible-default | text, placeholder "Taip nama atau email..." (debounce 300 ms, ≥ 2 characters) | FN-M21-3.1.3 |
| EL-M21-S4-021 | hidden-field | hidden-only | hidden, name=student_email | FN-M21-3.1.3 |
| EL-M21-S4-022 | clickable | hidden-only | search result row (Alpine template x-for s in results): name + e-mail · school (school part only when present); never rendered | FN-M21-3.1.3 |
| EL-M21-S4-023 | text | hidden-only | "()" (selected student line: name + " (" + e-mail + ")") | FN-M21-3.1.3 |
| EL-M21-S4-024 | label | visible-default | "Kategori" | FN-M21-3.1.4 |
| EL-M21-S4-025 | select | visible-default | name=student_category: "" "-", B40, Asnaf, Yatim, OKU | FN-M21-3.1.4 |
| EL-M21-S4-026 | label | visible-default | "Saluran" | FN-M21-3.1.4 |
| EL-M21-S4-027 | select | visible-default | name=channel, required: direct "Direct", mlm "Via Agent" | FN-M21-3.1.4 |
| EL-M21-S4-028 | button | visible-default | submit "Assign", fa-plus | FN-M21-3.1.4 |
| EL-M21-S4-029 | filter | visible-default | "Semua (1)", → ?status=all | FN-M21-3.1.6 |
| EL-M21-S4-030 | filter | visible-default | "Aktif (1)", → ?status=active | FN-M21-3.1.6 |
| EL-M21-S4-031 | filter | visible-default | "Graduated (0)", → ?status=graduated | FN-M21-3.1.6 |
| EL-M21-S4-032 | filter | visible-default | "Withdrawn (0)", → ?status=withdrawn | FN-M21-3.1.6 |
| EL-M21-S4-033 | filter | visible-default | "Expired (0)", → ?status=expired | FN-M21-3.1.6 |
| EL-M21-S4-034 | card | visible-default | "<person>" (table card; the first cell is the over-masked organisation) | FN-M21-3.1.7 |
| EL-M21-S4-035 | table | visible-default | columns "#", "Penaja", "Pelajar", "Kategori", "Saluran", "Status", "Tarikh", "Aksi"; 1 row (#2) | FN-M21-3.1.7 |
| EL-M21-S4-036 | badge | visible-default | "B40" | FN-M21-3.1.7 |
| EL-M21-S4-037 | badge | visible-default | "Direct" | FN-M21-3.1.7 |
| EL-M21-S4-038 | badge | visible-default | "Active" | FN-M21-3.1.7 |
| EL-M21-S4-039 | form | visible-default | POST → /admin/anak-angkat/2/status (graduate) | FN-M21-3.1.8 |
| EL-M21-S4-040 | hidden-field | hidden-only | hidden, name=_token | FN-M21-3.1.8 |
| EL-M21-S4-041 | hidden-field | hidden-only | hidden, name=status (graduated) | FN-M21-3.1.8 |
| EL-M21-S4-042 | button | visible-default | submit "Graduate" | FN-M21-3.1.8 |
| EL-M21-S4-043 | form | visible-default | POST → /admin/anak-angkat/2/status (withdraw) | FN-M21-3.1.8 |
| EL-M21-S4-044 | hidden-field | hidden-only | hidden, name=_token | FN-M21-3.1.8 |
| EL-M21-S4-045 | hidden-field | hidden-only | hidden, name=status (withdrawn) | FN-M21-3.1.8 |
| EL-M21-S4-046 | button | visible-default | submit "Tarik" | FN-M21-3.1.8 |
| EL-M21-S4-047 | heading | conditional | "Oops! An Error Occurred" (Symfony 405) | FN-M21-1.2.6 |
| EL-M21-S4-048 | heading | conditional | "The server returned a "405 Method Not Allowed"." | FN-M21-1.2.6 |
| EL-M21-S4-049 | text | conditional | "Something is broken. Please let us know what you were doing when this error occurred. We will fix it as soon as possible. Sorry for any inconvenience caused." | FN-M21-1.2.6 |
| EL-M21-S4-050 | filter | conditional | "Semua (0)", → ?status=all (live on Graduated / Withdrawn / Expired; → "Semua (1)", DV-M21-03) | FN-M21-3.1.6 |

#### S5 — `/admin/anak-angkat/permohonan` (37 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M21-S5-001 | filter | visible-default | "Menunggu 3", → ?status=pending | FN-M21-4.1.1 |
| EL-M21-S5-002 | filter | visible-default | "Dalam Pool 0", → ?status=approved | FN-M21-4.1.1 |
| EL-M21-S5-003 | filter | visible-default | "Ditaja 0", → ?status=matched | FN-M21-4.1.1 |
| EL-M21-S5-004 | filter | visible-default | "Ditolak 0", → ?status=rejected | FN-M21-4.1.1 |
| EL-M21-S5-005 | card | visible-default | "<person>" (table card; first cell masked) | FN-M21-4.1.2 |
| EL-M21-S5-006 | table | visible-default | columns "#", "Pelajar", "Pemohon", "Kategori", "Sebab", "Status", "Aksi"; 3 rows (#3, #2, #1) | FN-M21-4.1.2 |
| EL-M21-S5-007 | badge | visible-default | "B40" (row #3) | FN-M21-4.1.2 |
| EL-M21-S5-008 | badge | visible-default | "Pending" (row #3) | FN-M21-4.1.2 |
| EL-M21-S5-009 | form | visible-default | POST → /admin/anak-angkat/permohonan/3/lulus | FN-M21-4.1.3 |
| EL-M21-S5-010 | hidden-field | hidden-only | hidden, name=_token | FN-M21-4.1.3 |
| EL-M21-S5-011 | button | visible-default | submit "Lulus", fa-check | FN-M21-4.1.3 |
| EL-M21-S5-012 | form | visible-default | POST → /admin/anak-angkat/permohonan/3/tolak, confirm "Tolak permohonan ini?" | FN-M21-4.1.4 |
| EL-M21-S5-013 | hidden-field | hidden-only | hidden, name=_token | FN-M21-4.1.4 |
| EL-M21-S5-014 | button | visible-default | submit "Tolak", fa-times | FN-M21-4.1.4 |
| EL-M21-S5-015 | badge | visible-default | "B40" (row #2) | FN-M21-4.1.2 |
| EL-M21-S5-016 | badge | visible-default | "Pending" (row #2) | FN-M21-4.1.2 |
| EL-M21-S5-017 | form | visible-default | POST → /admin/anak-angkat/permohonan/2/lulus | FN-M21-4.1.3 |
| EL-M21-S5-018 | hidden-field | hidden-only | hidden, name=_token | FN-M21-4.1.3 |
| EL-M21-S5-019 | button | visible-default | submit "Lulus", fa-check | FN-M21-4.1.3 |
| EL-M21-S5-020 | form | visible-default | POST → /admin/anak-angkat/permohonan/2/tolak, confirm "Tolak permohonan ini?" | FN-M21-4.1.4 |
| EL-M21-S5-021 | hidden-field | hidden-only | hidden, name=_token | FN-M21-4.1.4 |
| EL-M21-S5-022 | button | visible-default | submit "Tolak", fa-times | FN-M21-4.1.4 |
| EL-M21-S5-023 | badge | visible-default | "B40" (row #1) | FN-M21-4.1.2 |
| EL-M21-S5-024 | badge | visible-default | "Pending" (row #1) | FN-M21-4.1.2 |
| EL-M21-S5-025 | form | visible-default | POST → /admin/anak-angkat/permohonan/1/lulus | FN-M21-4.1.3 |
| EL-M21-S5-026 | hidden-field | hidden-only | hidden, name=_token | FN-M21-4.1.3 |
| EL-M21-S5-027 | button | visible-default | submit "Lulus", fa-check | FN-M21-4.1.3 |
| EL-M21-S5-028 | form | visible-default | POST → /admin/anak-angkat/permohonan/1/tolak, confirm "Tolak permohonan ini?" | FN-M21-4.1.4 |
| EL-M21-S5-029 | hidden-field | hidden-only | hidden, name=_token | FN-M21-4.1.4 |
| EL-M21-S5-030 | button | visible-default | submit "Tolak", fa-times | FN-M21-4.1.4 |
| EL-M21-S5-031 | text | conditional | "404" | FN-M21-1.2.5 |
| EL-M21-S5-032 | text | conditional | "🔍" | FN-M21-1.2.5 |
| EL-M21-S5-033 | heading | conditional | "Halaman Tidak Dijumpai" | FN-M21-1.2.5 |
| EL-M21-S5-034 | text | conditional | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?" | FN-M21-1.2.5 |
| EL-M21-S5-035 | link | conditional | "Halaman Utama", → / | FN-M21-1.2.5 |
| EL-M21-S5-036 | link | conditional | "Mula Latihan", → /latih-tubi | FN-M21-1.2.5 |
| EL-M21-S5-037 | text | conditional | "PRESTASIPLUS" | FN-M21-1.2.5 |

#### S6 — `/mohon-keluarga-angkat` (38 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M21-S6-001 | text | hidden-only | "LIVE:", fa-circle (tournament banner) | Excluded — M16 tournament banner carried by the user shell inside `<main>`; not M21 content |
| EL-M21-S6-002 | text | hidden-only | "MAIN" (tournament banner) | Excluded — M16 tournament banner carried by the user shell inside `<main>`; not M21 content |
| EL-M21-S6-003 | text | hidden-only | "DAFTAR" (tournament banner) | Excluded — M16 tournament banner carried by the user shell inside `<main>`; not M21 content |
| EL-M21-S6-004 | heading | visible-default | "Mohon Keluarga Angkat" | FN-M21-4.2.1 |
| EL-M21-S6-005 | text | visible-default | "Isi borang ini untuk memohon tajaan akses PrestasiPlus secara percuma." | FN-M21-4.2.1 |
| EL-M21-S6-006 | card | visible-default | "Email Pelajar" (form card) | FN-M21-4.2.2 |
| EL-M21-S6-007 | form | visible-default | POST → /mohon-keluarga-angkat | FN-M21-4.2.5 |
| EL-M21-S6-008 | hidden-field | hidden-only | hidden, name=_token | FN-M21-4.2.5 |
| EL-M21-S6-009 | label | visible-default | "Email Pelajar" | FN-M21-4.2.2 |
| EL-M21-S6-010 | input | visible-default | email, name=student_email, placeholder "pelajar@email.com", required | FN-M21-4.2.2 |
| EL-M21-S6-011 | text | visible-default | "Email pelajar yang berdaftar dalam PrestasiPlus. Jika pelajar belum daftar, minta mereka daftar terlebih dahulu di ." (hint without its link) | FN-M21-4.2.2 |
| EL-M21-S6-012 | link | visible-default | "sini", → /register | FN-M21-4.2.2 |
| EL-M21-S6-013 | label | visible-default | "Kategori Pelajar" | FN-M21-4.2.3 |
| EL-M21-S6-014 | select | visible-default | name=student_category, required: "" "Pilih kategori", B40 "B40 — Pendapatan rendah", Asnaf "Asnaf — Layak bantuan zakat", Yatim "Yatim — Tiada ibu/bapa", OKU "OKU — Orang kurang upaya", Lain-lain "Lain-lain" | FN-M21-4.2.3 |
| EL-M21-S6-015 | label | visible-default | "Anggaran Pendapatan Keluarga" | FN-M21-4.2.3 |
| EL-M21-S6-016 | select | visible-default | name=family_income_range: "" "Pilih (pilihan)", "Bawah RM1,000", "RM1,000 - RM2,500", "RM2,500 - RM4,000", "Atas RM4,000" | FN-M21-4.2.3 |
| EL-M21-S6-017 | label | visible-default | "Sebab Permohonan" | FN-M21-4.2.4 |
| EL-M21-S6-018 | textarea | visible-default | name=reason, rows 4, required, placeholder "Terangkan kenapa pelajar ini memerlukan tajaan..." | FN-M21-4.2.4 |
| EL-M21-S6-019 | text | visible-default | "Contoh sebab permohonan:", fa-lightbulb | FN-M21-4.2.4 |
| EL-M21-S6-020 | clickable | visible-default | "• Keluarga berpendapatan rendah (B40). Bapa bekerja sebagai buruh am, ibu suri rumah. Tidak mampu membayar yuran tuisyen tambahan untuk persediaan SPM." | FN-M21-4.2.4 |
| EL-M21-S6-021 | clickable | visible-default | "• Pelajar yatim piatu yang tinggal bersama nenek. Nenek sudah tua dan tiada pendapatan tetap. Pelajar ini berpotensi tetapi tiada akses kepada bahan pembelajaran digital." | FN-M21-4.2.4 |
| EL-M21-S6-022 | clickable | visible-default | "• Anak asnaf yang menerima bantuan zakat. Keluarga mempunyai 6 orang anak dan pendapatan tidak mencukupi untuk perbelanjaan pendidikan tambahan." | FN-M21-4.2.4 |
| EL-M21-S6-023 | clickable | visible-default | "• Pelajar OKU (masalah penglihatan) yang memerlukan akses digital kerana sukar membaca buku teks biasa. Platform digital lebih mesra OKU dengan saiz teks boleh dilaraskan." | FN-M21-4.2.4 |
| EL-M21-S6-024 | clickable | visible-default | "• Pelajar cemerlang dari keluarga miskin. Mendapat 5A dalam PT3 tetapi ibu bapa tidak mampu hantar ke tuisyen. Dengan PrestasiPlus, pelajar ini boleh belajar sendiri dari rumah." | FN-M21-4.2.4 |
| EL-M21-S6-025 | text | visible-default | "Klik mana-mana contoh untuk guna sebagai template. Sila ubahsuai mengikut situasi sebenar." | FN-M21-4.2.4 |
| EL-M21-S6-026 | button | visible-default | submit "Hantar Permohonan", fa-paper-plane | FN-M21-4.2.5 |
| EL-M21-S6-027 | text | visible-default | "Apa yang berlaku selepas mohon?" | FN-M21-4.2.6 |
| EL-M21-S6-028 | text | visible-default | "Admin semak dan luluskan permohonan (1-3 hari bekerja)" | FN-M21-4.2.6 |
| EL-M21-S6-029 | text | visible-default | "Pelajar masuk ke pool — sponsor/keluarga angkat boleh pilih" | FN-M21-4.2.6 |
| EL-M21-S6-030 | text | visible-default | "Bila sponsor pilih, pelajar dapat akses PERCUMA PrestasiPlus selama 1 sesi persekolahan" | FN-M21-4.2.6 |
| EL-M21-S6-031 | text | visible-default | "Keluarga angkat boleh pantau prestasi pelajar dari dashboard mereka" | FN-M21-4.2.6 |
| EL-M21-S6-032 | text | visible-default | "Siapa boleh mohon?" | FN-M21-4.2.6 |
| EL-M21-S6-033 | text | visible-default | "— mohon untuk diri sendiri" | FN-M21-4.2.6 |
| EL-M21-S6-034 | text | visible-default | "Pelajar sendiri" | FN-M21-4.2.6 |
| EL-M21-S6-035 | text | visible-default | "— mohon untuk anak" | FN-M21-4.2.6 |
| EL-M21-S6-036 | text | visible-default | "Ibu bapa" | FN-M21-4.2.6 |
| EL-M21-S6-037 | text | visible-default | "<person>" (over-masked; real copy "— mohon untuk pelajar yang dikenal pasti memerlukan") | FN-M21-4.2.6 |
| EL-M21-S6-038 | text | visible-default | "<person>" (over-masked; real copy "Guru / Kaunselor") | FN-M21-4.2.6 |

#### S7 — `/sponsor/register` (72 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M21-S7-001 | heading | visible-default | "PRESTASIPLUS" | FN-M21-5.1.1 |
| EL-M21-S7-002 | text | visible-default | "Pendaftaran Penaja" | FN-M21-5.1.1 |
| EL-M21-S7-003 | badge | visible-default | "Organisasi", fa-building (step pill) | FN-M21-5.1.1 |
| EL-M21-S7-004 | badge | visible-default | "Hubungan", fa-user (step pill) | FN-M21-5.1.1 |
| EL-M21-S7-005 | badge | visible-default | "Akaun", fa-lock (step pill) | FN-M21-5.1.1 |
| EL-M21-S7-006 | form | visible-default | POST → /sponsor/register | FN-M21-5.1.6 |
| EL-M21-S7-007 | hidden-field | hidden-only | hidden, name=_token | FN-M21-5.1.6 |
| EL-M21-S7-008 | card | visible-default | "Maklumat Organisasi" (step 1 card) | FN-M21-5.1.2 |
| EL-M21-S7-009 | heading | visible-default | "Maklumat Organisasi" | FN-M21-5.1.2 |
| EL-M21-S7-010 | label | visible-default | "Nama Organisasi / Syarikat *" | FN-M21-5.1.2 |
| EL-M21-S7-011 | input | visible-default | text, name=organization_name, placeholder "Contoh: Syarikat ABC Sdn Bhd", required | FN-M21-5.1.2 |
| EL-M21-S7-012 | label | visible-default | "Kategori Penaja *" | FN-M21-5.1.2 |
| EL-M21-S7-013 | clickable | visible-default | tile "Individu / Peribadi", fa-user | FN-M21-5.1.2 |
| EL-M21-S7-014 | clickable | visible-default | tile "Syarikat Swasta", fa-building | FN-M21-5.1.2 |
| EL-M21-S7-015 | clickable | visible-default | tile "Syarikat Berkaitan Kerajaan", fa-landmark | FN-M21-5.1.2 |
| EL-M21-S7-016 | clickable | visible-default | tile "Pertubuhan Bukan Kerajaan", fa-hands-helping | FN-M21-5.1.2 |
| EL-M21-S7-017 | clickable | visible-default | tile "Badan / Agensi Kerajaan", fa-university | FN-M21-5.1.2 |
| EL-M21-S7-018 | clickable | visible-default | tile "Bank / Institusi Kewangan", fa-piggy-bank | FN-M21-5.1.2 |
| EL-M21-S7-019 | clickable | visible-default | tile "Universiti / IPT", fa-graduation-cap | FN-M21-5.1.2 |
| EL-M21-S7-020 | clickable | visible-default | tile "Persatuan / Kesatuan", fa-users | FN-M21-5.1.2 |
| EL-M21-S7-021 | clickable | visible-default | tile "Koperasi", fa-handshake | FN-M21-5.1.2 |
| EL-M21-S7-022 | clickable | visible-default | tile "Kedai Buku / Alat Tulis", fa-book-reader | FN-M21-5.1.2 |
| EL-M21-S7-023 | clickable | visible-default | tile "Restoran / F&B", fa-utensils | FN-M21-5.1.2 |
| EL-M21-S7-024 | clickable | visible-default | tile "Syarikat Teknologi", fa-laptop-code | FN-M21-5.1.2 |
| EL-M21-S7-025 | clickable | visible-default | tile "Penyedia Pendidikan", fa-chalkboard-teacher | FN-M21-5.1.2 |
| EL-M21-S7-026 | hidden-field | hidden-only | hidden, name=category (set by the tile) | FN-M21-5.1.2 |
| EL-M21-S7-027 | label | visible-default | "No. Pendaftaran (SSM/ROC)" | FN-M21-5.1.2 |
| EL-M21-S7-028 | input | visible-default | text, name=registration_number, placeholder "Contoh: 202001012345" | FN-M21-5.1.2 |
| EL-M21-S7-029 | label | visible-default | "Penerangan Organisasi" | FN-M21-5.1.2 |
| EL-M21-S7-030 | textarea | visible-default | name=description, placeholder "Ringkasan tentang organisasi anda..." | FN-M21-5.1.2 |
| EL-M21-S7-031 | label | visible-default | "Laman Web" | FN-M21-5.1.2 |
| EL-M21-S7-032 | input | visible-default | url, name=website, placeholder "https://contoh.com" | FN-M21-5.1.2 |
| EL-M21-S7-033 | button | visible-default | button "Seterusnya", fa-arrow-right (alert "Sila pilih kategori penaja." without a tile) | FN-M21-5.1.2 |
| EL-M21-S7-034 | heading | conditional | "Maklumat Hubungan & Alamat" | FN-M21-5.1.3 |
| EL-M21-S7-035 | label | conditional | "Nama Pegawai Perhubungan *" | FN-M21-5.1.3 |
| EL-M21-S7-036 | input | conditional | text, name=contact_person_name, placeholder "Nama penuh", required | FN-M21-5.1.3 |
| EL-M21-S7-037 | label | conditional | "Jawatan" | FN-M21-5.1.3 |
| EL-M21-S7-038 | input | conditional | text, name=contact_person_position, placeholder "Contoh: Pengurus" | FN-M21-5.1.3 |
| EL-M21-S7-039 | label | conditional | "E-mel Perhubungan *" | FN-M21-5.1.3 |
| EL-M21-S7-040 | input | conditional | email, name=contact_email, placeholder "email@organisasi.com", required | FN-M21-5.1.3 |
| EL-M21-S7-041 | label | conditional | "No. Telefon *" | FN-M21-5.1.3 |
| EL-M21-S7-042 | input | conditional | tel, name=contact_phone, placeholder "012-3456789", required | FN-M21-5.1.3 |
| EL-M21-S7-043 | label | conditional | "Alamat *" | FN-M21-5.1.3 |
| EL-M21-S7-044 | textarea | conditional | name=address, placeholder "No. lot, jalan, taman...", required | FN-M21-5.1.3 |
| EL-M21-S7-045 | label | conditional | "Bandar *" | FN-M21-5.1.3 |
| EL-M21-S7-046 | input | conditional | text, name=city, placeholder "Kluang", required | FN-M21-5.1.3 |
| EL-M21-S7-047 | label | conditional | "Negeri *" | FN-M21-5.1.3 |
| EL-M21-S7-048 | select | conditional | name=state, required: "" "Pilih negeri" + 16 states (Johor … W.P. Labuan) | FN-M21-5.1.3 |
| EL-M21-S7-049 | label | conditional | "Poskod *" | FN-M21-5.1.3 |
| EL-M21-S7-050 | input | conditional | text, name=postcode, placeholder "86000", maxlength 5, required | FN-M21-5.1.3 |
| EL-M21-S7-051 | button | conditional | button "Kembali", fa-arrow-left (step 2) | FN-M21-5.1.3 |
| EL-M21-S7-052 | button | conditional | button "Seterusnya", fa-arrow-right (step 2) | FN-M21-5.1.3 |
| EL-M21-S7-053 | heading | conditional | "Akaun Log Masuk" | FN-M21-5.1.4 |
| EL-M21-S7-054 | label | conditional | "Nama Penuh Anda *" | FN-M21-5.1.4 |
| EL-M21-S7-055 | input | conditional | text, name=name, placeholder "Nama anda", required | FN-M21-5.1.4 |
| EL-M21-S7-056 | label | conditional | "E-mel Log Masuk *" | FN-M21-5.1.4 |
| EL-M21-S7-057 | input | conditional | email, name=email, placeholder "anda@email.com", required | FN-M21-5.1.4 |
| EL-M21-S7-058 | label | conditional | "Kata Laluan *" | FN-M21-5.1.4 |
| EL-M21-S7-059 | input | conditional | password (text while shown), name=password, placeholder "Minimum 6 aksara", required | FN-M21-5.1.4 |
| EL-M21-S7-060 | toggle | conditional | eye button, fa-eye-slash (password shown) | FN-M21-5.1.4 |
| EL-M21-S7-061 | label | conditional | "Sahkan Kata Laluan *" | FN-M21-5.1.4 |
| EL-M21-S7-062 | input | conditional | password, name=password_confirmation, placeholder "Taip semula kata laluan", required | FN-M21-5.1.4 |
| EL-M21-S7-063 | toggle | conditional | eye button, fa-eye | FN-M21-5.1.4 |
| EL-M21-S7-064 | text | conditional | "Dengan mendaftar, anda bersetuju bahawa permohonan ini akan disemak oleh pentadbir PRESTASIPLUS. Anda akan dimaklumkan melalui e-mel apabila status permohonan dikemaskini.", fa-info-circle | FN-M21-5.1.4 |
| EL-M21-S7-065 | button | conditional | button "Kembali", fa-arrow-left (step 3) | FN-M21-5.1.4 |
| EL-M21-S7-066 | button | conditional | submit "Hantar Permohonan", fa-paper-plane | FN-M21-5.1.4 |
| EL-M21-S7-067 | text | hidden-only | "Hantar Permohonan", fa-paper-plane (idle variant) | FN-M21-5.1.4 |
| EL-M21-S7-068 | text | hidden-only | "Menghantar...", fa-circle-notch (loading variant) | FN-M21-5.1.4 |
| EL-M21-S7-069 | text | visible-default | "Sudah ada akaun? ·" (inventory joins the text nodes around the first link; rendered order "Sudah ada akaun? Log Masuk · Daftar Sebagai Pelajar") | FN-M21-5.1.5 |
| EL-M21-S7-070 | link | visible-default | "Log Masuk", → /login | FN-M21-5.1.5 |
| EL-M21-S7-071 | link | visible-default | "Daftar Sebagai Pelajar", → /register | FN-M21-5.1.5 |
| EL-M21-S7-072 | link | visible-default | "Kembali ke Laman Utama", → /, fa-home | FN-M21-5.1.5 |

### 6.2 Shell elements

The shells are chrome owned by the global shell (00-global-ui, design/shells.md, M23) and by the modules whose entries they carry. Every element is excluded with its reason; the rows that render an M21 menu entry or header title name the M21 Function that specifies it.

#### SHA — admin-panel shell (chrome of S1–S5) — 217 elements, all excluded (13 carry an M21 entry or title specified by FN-M21-1.1.1 / 1.1.3)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M21-SHA-001 | link | visible-default | → /admin | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-002 | image | visible-default | logo | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-003 | text | visible-default | "Panel Pentadbir" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-004 | link | visible-default | "Command Center LIVE", → /admin/command-center | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-005 | badge | visible-default | "LIVE" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-006 | link | visible-default | "Aktiviti Harian" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-007 | link | visible-default | "Audio KBAT" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-008 | text | visible-default | "HARIAN" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-009 | link | visible-default | "Dashboard", → /admin | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-010 | link | visible-default | "Laporan Eksekutif" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-011 | text | visible-default | "ANALITIK" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-012 | link | visible-default | "Analitik" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-013 | link | visible-default | "Monitoring" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-014 | toggle | visible-default | "Kirkpatrick" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-015 | link | hidden-only | "Overview", → /admin/kirkpatrick | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-016 | link | hidden-only | "T1: Reaksi" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-017 | link | hidden-only | "T2: Pembelajaran" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-018 | link | hidden-only | "T3: Tingkah Laku" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-019 | link | hidden-only | "T4: Hasil" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-020 | link | hidden-only | "Rantaian Impak" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-021 | link | hidden-only | "Intervensi" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-022 | link | visible-default | "Laporan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-023 | text | visible-default | "PENGURUSAN" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-024 | toggle | visible-default | "Kurikulum" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-025 | link | hidden-only | "Kurikulum" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-026 | link | hidden-only | "Subjek" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-027 | link | hidden-only | "Tahap Pendidikan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-028 | toggle | visible-default | "Soalan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-029 | link | hidden-only | "Senarai Soalan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-030 | link | hidden-only | "Import CSV" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-031 | link | hidden-only | "Kualiti Soalan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-032 | link | hidden-only | "Laporan Soalan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-033 | link | hidden-only | "Soalan Berstruktur" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-034 | link | hidden-only | "Kertas Soalan Guru" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-035 | toggle | visible-default | "Pengguna" (group holding the M21 entries) | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-036 | link | hidden-only | "Senarai Pengguna" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-037 | link | hidden-only | "Sekolah" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-038 | link | hidden-only | "Langganan Sekolah" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-039 | link | hidden-only | "Import Pelajar" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-040 | link | hidden-only | "Pelajar Komplimen" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-041 | link | hidden-only | "Import Pengguna" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-042 | link | hidden-only | "Penajaan", → /admin/sponsors | Excluded — admin shell sidebar; M21 entry specified by FN-M21-1.1.1 |
| EL-M21-SHA-043 | link | hidden-only | "Anak Angkat", → /admin/anak-angkat | Excluded — admin shell sidebar; M21 entry specified by FN-M21-1.1.1 |
| EL-M21-SHA-044 | link | hidden-only | "Permohonan", → /admin/anak-angkat/permohonan | Excluded — admin shell sidebar; M21 entry specified by FN-M21-1.1.1 |
| EL-M21-SHA-045 | toggle | visible-default | "SPM" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-046 | link | hidden-only | "Databank Soalan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-047 | link | hidden-only | "Latih Tubi" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-048 | link | hidden-only | "Tracking A" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-049 | link | hidden-only | "Subjektif" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-050 | toggle | visible-default | "Premium" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-051 | link | hidden-only | "PKSK Soalan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-052 | link | hidden-only | "PKSK Akses" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-053 | text | visible-default | "SISTEM" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-054 | toggle | visible-default | "Gamifikasi" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-055 | link | hidden-only | "Overview", → /admin/gamification | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-056 | link | hidden-only | "Tier Config" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-057 | link | hidden-only | "Cabaran" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-058 | link | hidden-only | "Pelajar" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-059 | link | hidden-only | "Transaksi" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-060 | link | hidden-only | "Kedai Hadiah" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-061 | link | hidden-only | "Gamifikasi Guru" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-062 | link | hidden-only | "Kawalan Reward" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-063 | toggle | visible-default | "Battle & Permainan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-064 | link | hidden-only | "Battle Live" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-065 | link | hidden-only | "Ranking Sekolah" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-066 | link | hidden-only | "Leaderboard" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-067 | link | hidden-only | "Tetapan Permainan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-068 | toggle | visible-default | "Marketplace" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-069 | link | hidden-only | "Produk" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-070 | link | hidden-only | "Penjual" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-071 | toggle | visible-default | "Kandungan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-072 | link | hidden-only | "Banner" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-073 | link | hidden-only | "Artikel" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-074 | link | hidden-only | "Nota" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-075 | link | hidden-only | "Push Notifikasi" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-076 | link | hidden-only | "Upload Screenshot" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-077 | toggle | visible-default | "Kewangan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-078 | link | hidden-only | "Pembayaran" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-079 | link | hidden-only | "Billing Dashboard" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-080 | link | hidden-only | "Dunning Log" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-081 | toggle | visible-default | "Sistem" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-082 | link | hidden-only | "Performance" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-083 | link | hidden-only | "Tetapan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-084 | link | hidden-only | "Log Audit" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-085 | link | hidden-only | "Chatbot" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-086 | text | visible-default | "🏆 Bilik Duta" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-087 | badge | visible-default | "DEV" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-088 | link | visible-default | "Bilik Duta" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-089 | link | visible-default | "Akademi Duta" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-090 | link | visible-default | "Permohonan Duta" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-091 | link | visible-default | "Duta Dashboard" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-092 | link | visible-default | "Jemput Duta" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-093 | link | visible-default | "Kem & Bootcamp" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-094 | text | visible-default | "🤖 Pusat AI" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-095 | link | visible-default | "Kamus AI" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-096 | link | visible-default | "Aktiviti Advisor" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-097 | link | visible-default | "Pendamping Motivasi" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-098 | link | visible-default | "SPM Walkthrough" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-099 | link | visible-default | "Whiteboard → Quiz" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-100 | link | visible-default | "Parent Whisperer" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-101 | link | visible-default | "Doa & Motivasi" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-102 | text | visible-default | "✨ Visi & Pertandingan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-103 | link | visible-default | "Profil Cerah" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-104 | link | visible-default | "Sekolah Bersaing" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-105 | link | visible-default | "Cita-Cita Hijrah" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-106 | link | visible-default | "Streak / Kombo" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-107 | text | visible-default | "💎 Killer Features" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-108 | link | visible-default | "Cikgu Suara" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-109 | link | visible-default | "SPM Mock Exam" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-110 | link | visible-default | "Wellbeing Alerts" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-111 | link | visible-default | "Tetapan Peribadi" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-112 | link | visible-default | "Ke Dashboard", → /dashboard | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-113 | card | visible-default | "Admin PRESTASI+" (user card; seed "Admin Demo", M01) | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-114 | image | visible-default | avatar | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-115 | text | visible-default | "Admin PRESTASI+" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-116 | text | visible-default | "Admin" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-117 | link | visible-default | → /logout | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-118 | heading | visible-default | "Pengurusan Penaja" | Excluded — admin shell header; M21 title specified by FN-M21-1.1.3 |
| EL-M21-SHA-119 | text | visible-default | "Semak dan urus permohonan penaja" | Excluded — admin shell header; M21 title specified by FN-M21-1.1.3 |
| EL-M21-SHA-120 | tooltip | hidden-only | "Uptime" | Excluded — admin-shell server-status chips (M23) |
| EL-M21-SHA-121 | tooltip | visible-default | "Load: 0.27 / 8 cores" | Excluded — admin-shell server-status chips (M23) |
| EL-M21-SHA-122 | text | visible-default | "3%" | Excluded — admin-shell server-status chips (M23) |
| EL-M21-SHA-123 | tooltip | visible-default | "19.7GB / 31.1GB" | Excluded — admin-shell server-status chips (M23) |
| EL-M21-SHA-124 | text | visible-default | "63%" | Excluded — admin-shell server-status chips (M23) |
| EL-M21-SHA-125 | tooltip | visible-default | "201.2GB / 398.7GB" | Excluded — admin-shell server-status chips (M23) |
| EL-M21-SHA-126 | text | visible-default | "50%" | Excluded — admin-shell server-status chips (M23) |
| EL-M21-SHA-127 | tooltip | visible-default | "Uptime" | Excluded — admin-shell server-status chips (M23) |
| EL-M21-SHA-128 | text | visible-default | "205d 23h" | Excluded — admin-shell server-status chips (M23) |
| EL-M21-SHA-129 | image | visible-default | avatar | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-130 | link | visible-default | → /logout | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-131 | link | conditional | → /admin | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-132 | image | conditional | logo | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-133 | text | visible-default | "© 2026 PRESTASIPLUS. Hakcipta Terpelihara." | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-134 | text | visible-default | "Didikan penuh dari Malaysia 🇲🇾" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-135 | text | visible-default | "❤️" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-136 | link | conditional | "Dashboard", → /admin (bottom nav) | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-137 | link | conditional | "Soalan", → /admin/questions (bottom nav) | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-138 | link | conditional | "Penaja", → /admin/sponsors (bottom nav) | Excluded — admin shell bottom nav; M21 entry specified by FN-M21-1.1.1 |
| EL-M21-SHA-139 | link | conditional | "Pengguna", → /admin/users (bottom nav) | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-140 | dropdown-trigger | conditional | "Lagi" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-141 | card | hidden-only | "SPM" ("Lagi" drawer) | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-142 | link | hidden-only | "Analitik" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-143 | link | hidden-only | "Laporan Aktiviti" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-144 | link | hidden-only | "Monitoring" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-145 | link | hidden-only | "Kirkpatrick" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-146 | text | hidden-only | "SPM" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-147 | link | hidden-only | "Databank Soalan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-148 | link | hidden-only | "Latih Tubi" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-149 | link | hidden-only | "Tracking A" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-150 | link | hidden-only | "Subjektif" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-151 | text | hidden-only | "Soalan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-152 | link | hidden-only | "Import CSV" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-153 | link | hidden-only | "Kualiti Soalan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-154 | link | hidden-only | "Laporan Soalan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-155 | link | hidden-only | "Soalan Berstruktur" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-156 | link | hidden-only | "Kertas Soalan Guru" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-157 | text | hidden-only | "Kurikulum" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-158 | link | hidden-only | "Kurikulum" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-159 | link | hidden-only | "Subjek" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-160 | link | hidden-only | "Tahap Pendidikan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-161 | text | hidden-only | "Premium" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-162 | link | hidden-only | "PKSK Soalan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-163 | link | hidden-only | "PKSK Akses" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-164 | text | hidden-only | "Gamifikasi" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-165 | link | hidden-only | "Overview" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-166 | link | hidden-only | "Tier Config" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-167 | link | hidden-only | "Cabaran" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-168 | link | hidden-only | "Kedai Hadiah" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-169 | link | hidden-only | "Gamifikasi Guru" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-170 | text | hidden-only | "Battle & Permainan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-171 | link | hidden-only | "Battle Live" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-172 | link | hidden-only | "Tetapan Permainan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-173 | text | hidden-only | "Kandungan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-174 | link | hidden-only | "Banner" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-175 | link | hidden-only | "Artikel" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-176 | link | hidden-only | "Nota" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-177 | link | hidden-only | "Push Notifikasi" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-178 | link | hidden-only | "Chatbot" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-179 | link | hidden-only | "Upload Screenshot" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-180 | text | hidden-only | "Marketplace" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-181 | link | hidden-only | "Produk" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-182 | link | hidden-only | "Penjual" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-183 | text | hidden-only | "Sistem" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-184 | link | hidden-only | "Sekolah" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-185 | link | hidden-only | "Langganan Sekolah" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-186 | link | hidden-only | "Tetapan" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-187 | link | hidden-only | "Pembayaran" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-188 | link | hidden-only | "Billing Dashboard" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-189 | link | hidden-only | "Dunning Log" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-190 | link | hidden-only | "Log Audit" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-191 | link | hidden-only | "Performance" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-192 | link | hidden-only | "Import Pelajar" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-193 | link | hidden-only | "Import Pengguna" | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-194 | link | hidden-only | "Student View", → /dashboard | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-195 | link | hidden-only | "Log Keluar", → /logout | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-196 | tooltip | conditional | "Load: 0.3 / 8 cores" | Excluded — admin-shell server-status chips (M23) |
| EL-M21-SHA-197 | tooltip | conditional | "Load: 0.5 / 8 cores" | Excluded — admin-shell server-status chips (M23) |
| EL-M21-SHA-198 | tooltip | conditional | "19.8GB / 31.1GB" | Excluded — admin-shell server-status chips (M23) |
| EL-M21-SHA-199 | tooltip | hidden-only | "Load: 0.31 / 8 cores" | Excluded — admin-shell server-status chips (M23) |
| EL-M21-SHA-200 | heading | conditional | "Tambah Penaja Baru" | Excluded — admin shell header; M21 title specified by FN-M21-1.1.3 |
| EL-M21-SHA-201 | text | conditional | "Daftar penaja baru (auto-diluluskan)" | Excluded — admin shell header; M21 title specified by FN-M21-1.1.3 |
| EL-M21-SHA-202 | tooltip | conditional | "Load: 0.35 / 8 cores" | Excluded — admin-shell server-status chips (M23) |
| EL-M21-SHA-203 | heading | conditional | "Edit Penaja" | Excluded — admin shell header; M21 title specified by FN-M21-1.1.3 |
| EL-M21-SHA-204 | text | conditional | "<name>" (organisation name, over-masked by discovery) | Excluded — admin shell header; M21 title specified by FN-M21-1.1.3 |
| EL-M21-SHA-205 | tooltip | conditional | "Load: 0.38 / 8 cores" | Excluded — admin-shell server-status chips (M23) |
| EL-M21-SHA-206 | heading | conditional | "Anak Angkat — Sponsorship" | Excluded — admin shell header; M21 title specified by FN-M21-1.1.3 |
| EL-M21-SHA-207 | text | conditional | "Selamat datang, Admin" (S4 and S5) | Excluded — admin shell header; M21 title specified by FN-M21-1.1.3 |
| EL-M21-SHA-208 | tooltip | conditional | "Load: 0.54 / 8 cores" | Excluded — admin-shell server-status chips (M23) |
| EL-M21-SHA-209 | tooltip | conditional | "201.4GB / 398.7GB" | Excluded — admin-shell server-status chips (M23) |
| EL-M21-SHA-210 | tooltip | conditional | "Load: 0.46 / 8 cores" | Excluded — admin-shell server-status chips (M23) |
| EL-M21-SHA-211 | link | hidden-only | "Import Pelajar", → /admin/import-<name>s (href over-masked by discovery) | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-212 | link | hidden-only | "Pelajar Komplimen", → /admin/comp-<name>s (href over-masked) | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-213 | link | hidden-only | "Pelajar", → /admin/gamification/<name>s (href over-masked) | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-214 | link | conditional | "Parent Whisperer", → /pusat-ai/<name>-whisperer (href over-masked) | Excluded — admin shell chrome (shells.md; owning modules) |
| EL-M21-SHA-215 | heading | conditional | "Permohonan Keluarga Angkat" | Excluded — admin shell header; M21 title specified by FN-M21-1.1.3 |
| EL-M21-SHA-216 | tooltip | conditional | "Load: 0.32 / 8 cores" | Excluded — admin-shell server-status chips (M23) |
| EL-M21-SHA-217 | link | hidden-only | "Import Pelajar", → /admin/import-<name>s (href over-masked) | Excluded — admin shell chrome (shells.md; owning modules) |

#### SHU — user-portal shell (chrome of S6) — 372 elements, all excluded (3 carry an M21 entry or title specified by FN-M21-1.1.2 / 1.1.3)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M21-SHU-001 | link | visible-default | → /dashboard | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-002 | image | visible-default | logo | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-003 | text | visible-default | "Platform Latih Tubi Nasional" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-004 | link | visible-default | "Dashboard" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-005 | link | visible-default | "Target SPM" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-006 | link | visible-default | "Misi Harian" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-007 | link | visible-default | "Remedial" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-008 | text | visible-default | "SPM" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-009 | link | visible-default | "SPM SPM" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-010 | badge | visible-default | "SPM" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-011 | link | visible-default | "Headcount" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-012 | link | visible-default | "Prestasi" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-013 | link | visible-default | "Analitik Adaptif" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-014 | link | visible-default | "Analisa Item" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-015 | link | visible-default | "Kombo" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-016 | link | visible-default | "Laporan Mingguan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-017 | text | visible-default | "Pusat AI" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-018 | badge | visible-default | "NEW" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-019 | text | visible-default | "🤖 Cikgu Alesa AI" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-020 | link | visible-default | "Cikgu Alesa Chat AI" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-021 | badge | visible-default | "AI" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-022 | text | visible-default | "✨ Visi & Pertandingan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-023 | link | visible-default | "Sekolah Bersaing NEW" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-024 | badge | visible-default | "NEW" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-025 | link | visible-default | "Tetapan Peribadi" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-026 | text | visible-default | "🏆 Bilik Duta · 🔒 PREVIEW" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-027 | link | visible-default | "Bilik Duta DEV" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-028 | badge | visible-default | "DEV" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-029 | text | visible-default | "🤖 AI Pintar (Pelajar)" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-030 | link | visible-default | "Wellbeing Alerts" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-031 | link | visible-default | "Kamus AI" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-032 | link | visible-default | "Pendamping Motivasi" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-033 | link | visible-default | "Doa & Motivasi" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-034 | text | visible-default | "🎯 AI Pintar (Guru)" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-035 | link | visible-default | "Aktiviti Advisor" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-036 | link | visible-default | "Whiteboard → Quiz" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-037 | link | visible-default | "RPH (Cikgu Alesa)" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-038 | link | visible-default | "Semak Karangan (Cikgu Alesa)" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-039 | link | visible-default | "PBD (Cikgu Alesa)" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-040 | text | visible-default | "🛡️ Kawalan Kualiti" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-041 | link | visible-default | "Semakan Nota Master" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-042 | link | visible-default | "Audit Log" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-043 | text | visible-default | "🏆 Bilik Duta" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-044 | link | visible-default | "Bilik Duta" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-045 | link | visible-default | "Akademi Duta" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-046 | link | visible-default | "Kem & Bootcamp" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-047 | text | visible-default | "✨ Visi & Pertandingan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-048 | link | visible-default | "Profil Cerah" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-049 | link | visible-default | "Sekolah Bersaing" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-050 | link | visible-default | "Cita-Cita Hijrah" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-051 | text | visible-default | "💎 Killer Features" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-052 | link | visible-default | "Cikgu Suara" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-053 | link | visible-default | "SPM Mock Exam" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-054 | link | visible-default | "Wellbeing Alerts" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-055 | link | visible-default | "Pembetulan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-056 | link | visible-default | "Mohon Keluarga Angkat", → /mohon-keluarga-angkat | Excluded — user shell menu; M21 entry specified by FN-M21-1.1.2 |
| EL-M21-SHU-057 | link | visible-default | "Penguasaan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-058 | link | visible-default | "Laporan Soalan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-059 | link | visible-default | "Liga Pertandingan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-060 | link | visible-default | "Perutusan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-061 | text | visible-default | "Pembelajaran" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-062 | link | visible-default | "Latih Tubi" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-063 | link | visible-default | "Soalan by Chapter" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-064 | link | visible-default | "Soalan Berstruktur" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-065 | link | visible-default | "Kedudukan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-066 | link | visible-default | "PKSK PRO" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-067 | badge | visible-default | "PRO" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-068 | link | visible-default | "Artikel" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-069 | link | visible-default | "Video" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-070 | link | visible-default | "Permainan 🎮" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-071 | badge | visible-default | "🎮" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-072 | link | visible-default | "Cabutan Bertuah 🎟️" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-073 | badge | visible-default | "🎟️" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-074 | link | visible-default | "Tournament" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-075 | link | visible-default | "Topik" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-076 | link | visible-default | "Peta Belajar" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-077 | link | visible-default | "Kelas Saya" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-078 | link | visible-default | "Set Soalan Guru" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-079 | link | visible-default | "Audio KBAT" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-080 | link | visible-default | "Syiling & Token 🏆" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-081 | badge | visible-default | "🏆" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-082 | link | visible-default | "Tukar Token" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-083 | link | visible-default | "Cabaran Harian" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-084 | link | visible-default | "Kedai Hadiah" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-085 | link | visible-default | "Kelulusan Hadiah" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-086 | link | visible-default | "Marketplace" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-087 | link | visible-default | "Papan Pendahulu" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-088 | link | visible-default | "Pencapaian" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-089 | link | visible-default | "Kotak Misteri" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-090 | link | visible-default | "Rujuk Kawan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-091 | link | visible-default | "Cikgu Alesa AI" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-092 | badge | visible-default | "AI" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-093 | text | visible-default | "Cikgu Alesa Tools" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-094 | link | visible-default | "RPH (Rancangan Harian)" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-095 | link | visible-default | "PBD Auto-Tag" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-096 | link | visible-default | "Mark Karangan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-097 | link | visible-default | "Admin Tebusan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-098 | link | visible-default | "Timeline Saya" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-099 | text | visible-default | "Portal Guru" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-100 | link | visible-default | "Dashboard Guru" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-101 | link | visible-default | "Kelas Guru" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-102 | link | visible-default | "Sumbang Soalan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-103 | link | visible-default | "Databank Soalan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-104 | text | visible-default | "PPD / JPN" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-105 | link | visible-default | "Dashboard PPD" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-106 | link | visible-default | "Statistik PPD" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-107 | link | visible-default | "Ranking Kebangsaan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-108 | link | visible-default | "Dashboard JPN" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-109 | link | visible-default | "Ranking Kebangsaan JPN" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-110 | text | visible-default | "Admin" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-111 | link | visible-default | "Ke Admin Panel" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-112 | link | visible-default | "Soalan by Chapter" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-113 | link | visible-default | "Billing Dashboard" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-114 | link | visible-default | "Urus Produk" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-115 | link | visible-default | "Urus Penjual" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-116 | link | visible-default | "Urus Hadiah" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-117 | link | visible-default | "Gamifikasi Guru" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-118 | link | visible-default | "Kertas Soalan Guru" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-119 | link | visible-default | "Profil Saya" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-120 | link | visible-default | "Pakej 💎" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-121 | badge | visible-default | "💎" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-122 | link | visible-default | "Invois Saya" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-123 | link | visible-default | "Panduan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-124 | text | visible-default | "Bantuan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-125 | link | visible-default | "Tiket Bantuan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-126 | link | visible-default | "Gambar Rajah 6,144" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-127 | badge | visible-default | "6,144" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-128 | link | visible-default | "Urus Tiket 2" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-129 | badge | visible-default | "2" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-130 | card | visible-default | "<name>" (user card, masked) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-131 | image | visible-default | avatar | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-132 | text | visible-default | "<name>" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-133 | text | visible-default | "<masked>" (e-mail) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-134 | link | visible-default | → /logout | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-135 | toggle | visible-default | sidebar toggle | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-136 | heading | visible-default | "Dashboard" (S6 header title on live) | Excluded — user shell header; M21 title specified by FN-M21-1.1.3 (DV-M21-06) |
| EL-M21-SHU-137 | text | visible-default | "Selamat datang kembali" | Excluded — user shell header; M21 title specified by FN-M21-1.1.3 (DV-M21-06) |
| EL-M21-SHU-138 | text | visible-default | "256" | Excluded — user-shell coin / mata / streak chips (M14) |
| EL-M21-SHU-139 | text | visible-default | "koin" | Excluded — user-shell coin / mata / streak chips (M14) |
| EL-M21-SHU-140 | text | visible-default | "8" | Excluded — user-shell coin / mata / streak chips (M14) |
| EL-M21-SHU-141 | text | visible-default | "mata" | Excluded — user-shell coin / mata / streak chips (M14) |
| EL-M21-SHU-142 | text | visible-default | "1" | Excluded — user-shell coin / mata / streak chips (M14) |
| EL-M21-SHU-143 | text | visible-default | "hari 🔥" | Excluded — user-shell coin / mata / streak chips (M14) |
| EL-M21-SHU-144 | link | visible-default | "99+", → /notifikasi | Excluded — user-shell bell (M22) |
| EL-M21-SHU-145 | badge | visible-default | "99+" | Excluded — user-shell bell (M22) |
| EL-M21-SHU-146 | image | visible-default | avatar | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-147 | link | visible-default | → /logout | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-148 | toggle | conditional | hamburger | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-149 | link | conditional | → /dashboard | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-150 | image | conditional | logo | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-151 | text | conditional | "256" | Excluded — user-shell coin / mata / streak chips (M14) |
| EL-M21-SHU-152 | text | conditional | "koin" | Excluded — user-shell coin / mata / streak chips (M14) |
| EL-M21-SHU-153 | text | conditional | "8" | Excluded — user-shell coin / mata / streak chips (M14) |
| EL-M21-SHU-154 | text | conditional | "mata" | Excluded — user-shell coin / mata / streak chips (M14) |
| EL-M21-SHU-155 | text | conditional | "1" | Excluded — user-shell coin / mata / streak chips (M14) |
| EL-M21-SHU-156 | text | conditional | "🔥" | Excluded — user-shell coin / mata / streak chips (M14) |
| EL-M21-SHU-157 | text | visible-default | "© 2026 PRESTASIPLUS. Hakcipta Terpelihara" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-158 | text | visible-default | "✨" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-159 | text | visible-default | "Didikan penuh dari Malaysia" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-160 | text | visible-default | "❤️" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-161 | text | visible-default | "🇲🇾" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-162 | clickable | hidden-only | drawer overlay | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-163 | modal | hidden-only | "<name>" (mobile drawer) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-164 | image | hidden-only | logo | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-165 | text | hidden-only | "Platform Latih Tubi Nasional" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-166 | button | hidden-only | close drawer | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-167 | image | hidden-only | avatar | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-168 | text | hidden-only | "<name>" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-169 | text | hidden-only | "admin" (raw role code) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-170 | link | hidden-only | "Dashboard" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-171 | modal | hidden-only | "SPM" (drawer section) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-172 | text | hidden-only | "SPM" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-173 | link | hidden-only | "SPM SPM" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-174 | badge | hidden-only | "SPM" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-175 | link | hidden-only | "Headcount" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-176 | link | hidden-only | "Prestasi" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-177 | link | hidden-only | "Analisa Item" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-178 | link | hidden-only | "Amaran Awal" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-179 | link | hidden-only | "Kombo" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-180 | link | hidden-only | "Cikgu Alesa AI" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-181 | badge | hidden-only | "AI" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-182 | link | hidden-only | "RPH" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-183 | link | hidden-only | "PBD Auto-Tag" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-184 | link | hidden-only | "Mark Karangan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-185 | link | hidden-only | "Laporan Mingguan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-186 | link | hidden-only | "Pembetulan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-187 | link | hidden-only | "Penguasaan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-188 | link | hidden-only | "Laporan Soalan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-189 | link | hidden-only | "Command Center LIVE", → /ppd/command-center | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-190 | badge | hidden-only | "LIVE" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-191 | link | hidden-only | "Dashboard PPD" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-192 | link | hidden-only | "Statistik Penggunaan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-193 | link | hidden-only | "Ranking Kebangsaan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-194 | link | hidden-only | "Benchmark Sekolah" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-195 | link | hidden-only | "Peta Haba" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-196 | link | hidden-only | "Export Laporan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-197 | link | hidden-only | "Leaderboard Sekolah" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-198 | link | hidden-only | "Dashboard JPN" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-199 | link | hidden-only | "Statistik Penggunaan" (JPN) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-200 | link | hidden-only | "Ranking Kebangsaan" (JPN) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-201 | modal | hidden-only | "Pembelajaran" (drawer section) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-202 | text | hidden-only | "Pembelajaran" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-203 | link | hidden-only | "Latih Tubi" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-204 | link | hidden-only | "Soalan by Chapter" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-205 | link | hidden-only | "Soalan Berstruktur" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-206 | link | hidden-only | "Kedudukan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-207 | link | hidden-only | "PKSK PRO" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-208 | badge | hidden-only | "PRO" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-209 | link | hidden-only | "Artikel" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-210 | link | hidden-only | "Video" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-211 | link | hidden-only | "Permainan 🎮" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-212 | badge | hidden-only | "🎮" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-213 | link | hidden-only | "Cabutan Bertuah 🎟️" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-214 | badge | hidden-only | "🎟️" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-215 | link | hidden-only | "Tournament" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-216 | link | hidden-only | "Topik" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-217 | link | hidden-only | "Peta Belajar" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-218 | link | hidden-only | "Command Center LIVE", → /guru/command-center | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-219 | badge | hidden-only | "LIVE" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-220 | text | hidden-only | "Pusat AI" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-221 | badge | hidden-only | "NEW" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-222 | text | hidden-only | "🤖 Cikgu Alesa AI" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-223 | link | hidden-only | "Cikgu Alesa Chat AI" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-224 | badge | hidden-only | "AI" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-225 | text | hidden-only | "✨ Visi & Pertandingan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-226 | link | hidden-only | "Sekolah Bersaing NEW" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-227 | badge | hidden-only | "NEW" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-228 | link | hidden-only | "Tetapan Peribadi" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-229 | text | hidden-only | "🏆 Bilik Duta · 🔒 PREVIEW" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-230 | link | hidden-only | "Bilik Duta DEV" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-231 | badge | hidden-only | "DEV" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-232 | text | hidden-only | "🤖 AI Pintar (Pelajar)" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-233 | link | hidden-only | "Wellbeing Alerts" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-234 | link | hidden-only | "Kamus AI" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-235 | link | hidden-only | "Pendamping Motivasi" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-236 | link | hidden-only | "Doa & Motivasi" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-237 | text | hidden-only | "🎯 AI Pintar (Guru)" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-238 | link | hidden-only | "Aktiviti Advisor" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-239 | link | hidden-only | "Whiteboard → Quiz" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-240 | link | hidden-only | "RPH (Cikgu Alesa)" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-241 | link | hidden-only | "Semak Karangan (Cikgu Alesa)" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-242 | link | hidden-only | "PBD (Cikgu Alesa)" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-243 | text | hidden-only | "🛡️ Kawalan Kualiti" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-244 | link | hidden-only | "Semakan Nota Master" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-245 | link | hidden-only | "Audit Log" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-246 | modal | hidden-only | "HARIAN" (drawer section) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-247 | text | hidden-only | "HARIAN" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-248 | link | hidden-only | "Dashboard Guru" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-249 | link | hidden-only | "Misi Harian" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-250 | link | hidden-only | "Soalan by Chapter" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-251 | link | hidden-only | "Kelas Saya" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-252 | link | hidden-only | "Pelajar Saya" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-253 | link | hidden-only | "Kehadiran Digital" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-254 | modal | hidden-only | "PENGAJARAN" (drawer section) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-255 | text | hidden-only | "PENGAJARAN" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-256 | link | hidden-only | "Jadual Belajar" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-257 | link | hidden-only | "Broadcast" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-258 | link | hidden-only | "Kelas Live" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-259 | modal | hidden-only | "PENILAIAN" (drawer section) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-260 | text | hidden-only | "PENILAIAN" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-261 | link | hidden-only | "Headcount" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-262 | link | hidden-only | "Prestasi", → /prestasi/kelas | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-263 | link | hidden-only | "Laporan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-264 | link | hidden-only | "Amaran Awal" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-265 | modal | hidden-only | "ANALITIK" (drawer section) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-266 | text | hidden-only | "ANALITIK" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-267 | link | hidden-only | "Monitoring" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-268 | toggle | hidden-only | "Kirkpatrick" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-269 | link | hidden-only | "Ringkasan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-270 | link | hidden-only | "T1: Reaksi" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-271 | link | hidden-only | "T2: Pembelajaran" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-272 | link | hidden-only | "T3: Tingkah Laku" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-273 | link | hidden-only | "T4: Hasil" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-274 | link | hidden-only | "Rantaian Impak" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-275 | link | hidden-only | "Intervensi" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-276 | link | hidden-only | "Analisis Item" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-277 | link | hidden-only | "Perbandingan Kelas" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-278 | link | hidden-only | "Laporan Mingguan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-279 | modal | hidden-only | "BANK SOALAN" (drawer section) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-280 | text | hidden-only | "BANK SOALAN" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-281 | link | hidden-only | "Sumbang Soalan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-282 | link | hidden-only | "Soalan & Rujukan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-283 | link | hidden-only | "Soalan Berstruktur" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-284 | link | hidden-only | "Databank Soalan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-285 | link | hidden-only | "Set Soalan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-286 | modal | hidden-only | "LAIN-LAIN" (drawer section) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-287 | text | hidden-only | "LAIN-LAIN" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-288 | link | hidden-only | "Syiling & Ganjaran" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-289 | link | hidden-only | "Sumbang Artikel" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-290 | link | hidden-only | "Video" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-291 | link | hidden-only | "Kelas Saya BARU" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-292 | badge | hidden-only | "BARU" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-293 | link | hidden-only | "Set Soalan Guru" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-294 | modal | hidden-only | "Gamifikasi" (drawer section) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-295 | text | hidden-only | "Gamifikasi" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-296 | link | hidden-only | "Syiling & Token" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-297 | link | hidden-only | "Tukar Token" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-298 | link | hidden-only | "Cabaran Harian" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-299 | link | hidden-only | "Kedai Hadiah" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-300 | link | hidden-only | "Marketplace" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-301 | link | hidden-only | "Papan Pendahulu" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-302 | link | hidden-only | "Pencapaian" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-303 | link | hidden-only | "Kotak Misteri" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-304 | link | hidden-only | "Rujuk Kawan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-305 | link | hidden-only | "Timeline Saya" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-306 | link | hidden-only | "Invois Saya" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-307 | link | hidden-only | "Ke Admin Panel" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-308 | link | hidden-only | "Soalan by Chapter" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-309 | link | hidden-only | "Billing Dashboard" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-310 | link | hidden-only | "Urus Produk" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-311 | link | hidden-only | "Urus Penjual" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-312 | link | hidden-only | "Urus Hadiah" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-313 | link | hidden-only | "Gamifikasi Guru" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-314 | link | hidden-only | "Profil Saya" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-315 | link | hidden-only | "Tetapan", → /settings | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-316 | link | hidden-only | "Panduan" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-317 | link | hidden-only | "Log Keluar", → /logout | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-318 | text | hidden-only | "© 2026 PRESTASIPLUS 🇲🇾" | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-319 | text | hidden-only | "Pasang PRESTASIPLUS" | Excluded — PWA install prompt (global shell) |
| EL-M21-SHU-320 | text | hidden-only | "Akses pantas dari skrin utama" | Excluded — PWA install prompt (global shell) |
| EL-M21-SHU-321 | button | hidden-only | "Pasang" | Excluded — PWA install prompt (global shell) |
| EL-M21-SHU-322 | button | hidden-only | "10" | Excluded — PWA install prompt (global shell) |
| EL-M21-SHU-323 | card | hidden-only | "Pasang PRESTASIPLUS" | Excluded — PWA install prompt (global shell) |
| EL-M21-SHU-324 | image | hidden-only | app icon | Excluded — PWA install prompt (global shell) |
| EL-M21-SHU-325 | heading | hidden-only | "Pasang PRESTASIPLUS" | Excluded — PWA install prompt (global shell) |
| EL-M21-SHU-326 | text | hidden-only | "Ikuti langkah berikut:" | Excluded — PWA install prompt (global shell) |
| EL-M21-SHU-327 | badge | hidden-only | "1" | Excluded — PWA install prompt (global shell) |
| EL-M21-SHU-328 | text | hidden-only | "Tekan ikon Share" | Excluded — PWA install prompt (global shell) |
| EL-M21-SHU-329 | text | hidden-only | "Ikon di bawah skrin Safari" | Excluded — PWA install prompt (global shell) |
| EL-M21-SHU-330 | badge | hidden-only | "2" | Excluded — PWA install prompt (global shell) |
| EL-M21-SHU-331 | text | hidden-only | "Pilih "Add to Home Screen"" | Excluded — PWA install prompt (global shell) |
| EL-M21-SHU-332 | text | hidden-only | "Scroll ke bawah, tekan Add to Home Screen" | Excluded — PWA install prompt (global shell) |
| EL-M21-SHU-333 | badge | hidden-only | "3" | Excluded — PWA install prompt (global shell) |
| EL-M21-SHU-334 | text | hidden-only | "Tekan "Add"" | Excluded — PWA install prompt (global shell) |
| EL-M21-SHU-335 | text | hidden-only | "PRESTASIPLUS akan muncul di skrin utama anda" | Excluded — PWA install prompt (global shell) |
| EL-M21-SHU-336 | button | hidden-only | "Faham!" | Excluded — PWA install prompt (global shell) |
| EL-M21-SHU-337 | link | conditional | "Home", → /dashboard (bottom nav) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-338 | link | conditional | "SPM", → /spm (bottom nav) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-339 | link | conditional | "Game", → /permainan (bottom nav) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-340 | link | conditional | "Topik", → /topics (bottom nav) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-341 | toggle | conditional | "Chat" (bottom nav) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-342 | toggle | conditional | "Lagi" (bottom nav) | Excluded — user shell chrome (shells.md; owning modules) |
| EL-M21-SHU-343 | card | hidden-only | "Pembantu PrestasiPlus" | Excluded — chatbot widget (M22) |
| EL-M21-SHU-344 | text | hidden-only | "Pembantu PrestasiPlus" | Excluded — chatbot widget (M22) |
| EL-M21-SHU-345 | text | hidden-only | "Sedia membantu anda" | Excluded — chatbot widget (M22) |
| EL-M21-SHU-346 | button | hidden-only | close | Excluded — chatbot widget (M22) |
| EL-M21-SHU-347 | heading | hidden-only | "Selamat Datang!" | Excluded — chatbot widget (M22) |
| EL-M21-SHU-348 | text | hidden-only | "Sila masukkan maklumat anda sebelum memulakan perbualan." | Excluded — chatbot widget (M22) |
| EL-M21-SHU-349 | form | hidden-only | chatbot intro form | Excluded — chatbot widget (M22) |
| EL-M21-SHU-350 | label | hidden-only | "Nama" | Excluded — chatbot widget (M22) |
| EL-M21-SHU-351 | input | hidden-only | name input | Excluded — chatbot widget (M22) |
| EL-M21-SHU-352 | label | hidden-only | "No. Telefon" | Excluded — chatbot widget (M22) |
| EL-M21-SHU-353 | input | hidden-only | phone input | Excluded — chatbot widget (M22) |
| EL-M21-SHU-354 | button | hidden-only | "Mula Berbual" | Excluded — chatbot widget (M22) |
| EL-M21-SHU-355 | card | hidden-only | chat panel | Excluded — chatbot widget (M22) |
| EL-M21-SHU-356 | text | hidden-only | "Selamat datang, ! Saya Pembantu Maya PrestasiPlus. Bagaimana saya boleh membantu anda hari ini?" | Excluded — chatbot widget (M22) |
| EL-M21-SHU-357 | button | hidden-only | "Apakah PrestasiPlus?" | Excluded — chatbot widget (M22) |
| EL-M21-SHU-358 | button | hidden-only | "Cara mendaftar" | Excluded — chatbot widget (M22) |
| EL-M21-SHU-359 | button | hidden-only | "Harga langganan" | Excluded — chatbot widget (M22) |
| EL-M21-SHU-360 | card | hidden-only | "<name>" | Excluded — chatbot widget (M22) |
| EL-M21-SHU-361 | text | hidden-only | "Selamat datang, ! Saya Pembantu Maya PrestasiPlus. Bagaimana saya boleh membantu anda hari ini?" | Excluded — chatbot widget (M22) |
| EL-M21-SHU-362 | text | hidden-only | "<name>" | Excluded — chatbot widget (M22) |
| EL-M21-SHU-363 | button | hidden-only | "Apakah PrestasiPlus?" | Excluded — chatbot widget (M22) |
| EL-M21-SHU-364 | button | hidden-only | "Cara mendaftar" | Excluded — chatbot widget (M22) |
| EL-M21-SHU-365 | button | hidden-only | "Harga langganan" | Excluded — chatbot widget (M22) |
| EL-M21-SHU-366 | button | hidden-only | chat control | Excluded — chatbot widget (M22) |
| EL-M21-SHU-367 | button | hidden-only | chat control | Excluded — chatbot widget (M22) |
| EL-M21-SHU-368 | form | hidden-only | message form | Excluded — chatbot widget (M22) |
| EL-M21-SHU-369 | textarea | hidden-only | message input | Excluded — chatbot widget (M22) |
| EL-M21-SHU-370 | button | hidden-only | send | Excluded — chatbot widget (M22) |
| EL-M21-SHU-371 | text | hidden-only | "Dikuasakan oleh AI · Jawapan mungkin tidak sentiasa tepat" | Excluded — chatbot widget (M22) |
| EL-M21-SHU-372 | toggle | hidden-only | chatbot launcher | Excluded — chatbot widget (M22) |

---

## 7. Fidelity deviations

These are the **only** intended differences from the live site. Anything not listed must match live (D7). Rule D9 (user, standing, pre-approved): where live is broken or contradictory, fix it minimally; where it works, replicate it exactly; when unsure, follow live. D10: accessibility replicates live. D14: no external platform screen; hand-offs are simulated. Privacy overrides fidelity for personal data. Delivery Lead precedents applied: 405 on a route → global 404 (M19 DV-M19-07, M20 DV-M20-02); page beyond the last keeps the count of all matches (M20 DV-M20-05); mixed-language labels kept (M19 DV-M19-05, M20 DV-M20-08); no text below 12 px and no horizontal page scroll (CLAUDE.md §7). Rows "Rejected — replicate live" were considered and deliberately not changed.

| ID | Discovery | Category | Live behaviour (evidence) | Rebuild behaviour (specified) and alternatives | Status |
|---|---|---|---|---|---|
| DV-M21-01 | D-M21-01 | Broken link | S1 row "Lihat" → `GET /admin/sponsors/{id}` → global 500 "Ralat Pelayan" for every sponsor (EL S3-060–063; OBSERVED on #6 and #11). | `GET /admin/sponsors/{id}` redirects to `/admin/sponsors/{id}/edit` (S3), so "Lihat" keeps its label, icon and href and opens the sponsor's page (FN-M21-1.2.7, 2.1.6); unknown id → 404. Alternatives: (a) a new read-only sponsor view — rejected (new screen, content not observable); (b) remove "Lihat" — rejected (changes the observed row); (c) keep the 500 — rejected (broken). | Approved (D9) |
| DV-M21-02 | D-M21-02 | Unbranded error page | `GET /admin/anak-angkat/{x}` (`/2`, `/create`, `/pool`, `/sponsors`) and `GET /sponsor/profile` → Symfony "Oops! An Error Occurred" / "405 Method Not Allowed" (typed URLs only; EL S4-047–049). | Global 404 page (M19 / M20 precedent) (FN-M21-1.2.6, 6.1.6). Alternatives: a branded 405 page — rejected (new page); a redirect to S4 — rejected (invents a route). | Approved (D9, DL precedent) |
| DV-M21-03 | D-M21-03 | Contradictory figures | S4 tab "Semua (n)" shows the count of the current filter: on Graduated / Withdrawn / Expired it reads "Semua (0)" next to "Aktif (1)" while 1 record exists (EL S4-050; snapshot). | "Semua" always shows the total of all records (FN-M21-3.1.6); the other tabs are unchanged (global counts, as live). Alternatives: (a) make every tab follow the filter — rejected (changes the observed "Aktif (1)" on those tabs); (b) keep — rejected (the same row of tabs contradicts itself). | Approved (D9) |
| DV-M21-04 | D-M21-04 | Candidate — count above an empty page, English pager | S1 `?page=2` shows "6 penaja dijumpai" above "Tiada penaja dijumpai" and the Laravel pager "« Previous", "Next »", "Showing 0 of 6 results" (typed URL only; EL S1-040–045). | **Rejected — replicate live.** The count is the true total of the query; the page is out of range; the pager copy is the same Laravel pager used elsewhere (M20 DV-M20-05; mixed language as DV-M21-10) (FN-M21-1.3.3). | Rejected — replicate live |
| DV-M21-05 | D-M21-05 | Layout breakage | Horizontal page scroll at 375: S3 status card (scrollWidth 409, +49 px: form and "Aktifkan Semula" button) and S4 status tabs (397, +37 px) (snapshot `layout`). | The S3 status card wraps (status line above, button below) and the S4 tab row wraps onto a second line, so no page scrolls sideways at 320–375 (FN-M21-1.3.5, 2.3.4, 3.1.6). Alternative: a horizontally scrolling tab strip — rejected (a new pattern for S4; wrapping is the minimal change). | Approved (D9; CLAUDE.md §7) |
| DV-M21-06 | D-M21-06 | Wrong title | S6 keeps the user-shell header "Dashboard" / "Selamat datang kembali" while the page is "Mohon Keluarga Angkat" (EL SHU-136–137). | Header title **"Mohon Keluarga Angkat"**; subtitle "Selamat datang kembali" kept (not wrong) (FN-M21-1.1.3); same rule as shell DV-SH-03 and the M13 / M14 / M16 precedent. Alternatives: (a) also change the subtitle to the hero text — rejected (not minimal; the hero already shows it); (b) keep "Dashboard" — rejected (wrong title). | Approved (D9) |
| DV-M21-07 | D-M21-07 | Unreadable text | Text under 12 px (measured; AUD re-read): **S1** table 9–10 px at 375 (73 elements); **S4** at every width (7): the sponsor category line "SYARIKAT_SWASTA", the student-cell e-mail line, the badges "B40", "Direct", "Active" and the buttons "Graduate" / "Tarik"; the **S4 student-search** result second line "{e-mail} · {school}" 10 px (page source, AUD-M21-01); **S5** at every width (18): both student-cell lines (e-mail, school) of every row, "B40", "Pending", "Lulus", "Tolak"; **S6** the italic note (1); **S7** at 375 (20): the 13 tile labels, the 3 step pills "Organisasi", "Hubungan", "Akaun" and the 4 footer texts "Sudah ada akaun?", "Log Masuk", "Daftar Sebagai Pelajar", "Kembali ke Laman Utama". | Minimum 12 px for all these texts at every width; layout otherwise unchanged (FN-M21-1.3.5, 3.1.3, 3.1.7, 4.1.2, 4.2.4, 5.1.1, 5.1.2, 5.1.5). Alternative: keep — rejected (unreadable text is a D9 defect; the E2E rule forbids it). | Approved (D9) |
| DV-M21-08 | D-M21-08 | Wrong labels (raw codes) | S5 empty states "Tiada permohonan approved / matched / rejected"; S3 strip "SUSPENDED"; S4 sponsor line "SYARIKAT_SWASTA" — while the same pages use the BM labels ("Dalam Pool", "Ditaja", "Ditolak", "Digantung", "Syarikat Swasta") (EL S3-038; snapshot). | S5 **"Tiada permohonan dalam pool"**, **"Tiada permohonan ditaja"**, **"Tiada permohonan ditolak"** (and "Tiada permohonan menunggu"); S3 strip **"Digantung"**; S4 line **"Syarikat Swasta"** (FN-M21-2.3.2, 3.1.7, 4.1.5). The status-card code "(SUSPENDED)" is **kept**: it is a deliberate code annotation beside the label (OBSERVED for SUSPENDED, the only status on live; the same "{label} ({code})" pattern for PENDING / APPROVED / REJECTED is INFERRED). Alternatives: (a) replace "(SUSPENDED)" too — rejected (would print the label twice); (b) keep every raw code — rejected (wrong labels next to their BM counterparts). | Approved (D9) |
| DV-M21-09 | D-M21-09 | Candidate — bullet copied | Clicking an S6 example copies its leading "• " into the reason; live application #1 starts with "• ". | **Rejected — replicate live.** Harmless and consistent (every example behaves the same); the seed keeps the bullet (FN-M21-4.2.4). | Rejected — replicate live |
| DV-M21-10 | D-M21-10 | Candidate — mixed-language labels | "Assign", "Graduate", "Graduated", "Withdrawn", "Expired", "Active", "Pending", "Direct", "Via Agent", "Anak Angkat — Sponsorship", applicant roles "parent" / "student". | **Rejected — replicate live** (each is readable and names the same state; D9 "when unsure, follow live"; M19 / M20 precedent), except the raw codes of DV-M21-08. | Rejected — replicate live |
| DV-M21-11 | D-M21-11 | Candidate — inconsistent input | S2 / S3 "Negeri" is free text; S7 "Negeri *" is a select of 16 states. | **Rejected — replicate live.** Both work; the admin form deliberately accepts any text for existing records (FN-M21-2.2.4, 5.1.3). | Rejected — replicate live |
| DV-M21-12 | — (privacy) | Personal data | The contact officer (name, phone, e-mail, address) of #11, the sponsor login e-mails, the adopted student, the 3 applicant students, their school, the parent and the parent-written reason are real (masked by discovery). | Fictitious anchors (§0 conventions; SRS §6.11): "Hafiz Bin Contoh", `pegawai.alesa@demo.test`, `0100000011`, "No. 1, Jalan Contoh 1/1", "Shah Alam", "Selangor", "40000"; logins `sponsor1…5@demo.test` and `penaja@demo.test`; students "Irfan Hakimi Bin Contoh", "Nur Hajar Binti Demo", "Adam Haikal Bin Demo", "Aina Sofea Binti Demo"; parent "Rosnah Binti Demo"; a fictitious reason for #2 / #3. Organisation names, categories, descriptions, websites and dates stay as observed. | Approved (privacy override) |
| DV-M21-13 | C2 | Candidate — "Jumlah Penaja" 1 vs 6 | S4 "Jumlah Penaja" 1 while S1 "Jumlah" and M17 "Jumlah Penaja" read 6. | **Rejected — no D9 needed.** "Sponsors with at least one anak-angkat record" reproduces 1 on S4 while "all sponsors" reproduces 6 on S1 / M17; they are different pages and different named queries (FN-M21-3.1.1, 7.1.4). Alternative definition "sponsors with an active record" also gives 1 (OQ-M21-10). | Rejected — replicate live |
| DV-M21-14 | — (D14) | External hand-off | The S7 note promises "Anda akan dimaklumkan melalui e-mel apabila status permohonan dikemaskini." (no e-mail was observed). | User decision D14: no e-mail is sent and no external screen is built; each sponsor status change records a simulated e-mail notice in the mock log (SRS §6.13) and nothing is shown to the user. | Approved (D14) |
| DV-M21-15 | discovery §8.2 "not defects", C3 | Candidate — empty select, active sponsorship under a suspended sponsor | The S4 "Penaja" select lists no sponsor (all suspended); anak angkat #2 is "Active" under the suspended sponsor #11; only name and category are required on S2; the sponsor portal answers 403 for the admin. | **Rejected — replicate live.** Each is consistent observed data or a deliberate rule (FN-M21-3.1.2, 7.1.6, 2.2.2, 1.2.4). | Rejected — replicate live |
| DV-M21-16 | G5 QA M21 S6 (2026-10-10) | Visual bug — form controls not identifiable | S6 inputs, the two selects and the reason textarea render with no visible border or box at 375 / 768 / 1280 (`mohon-keluarga-angkat-desktop.png`, `-mobile.png`), so the field area cannot be told apart from the card. | **Approved — D9 fix (Delivery Lead).** S6 fields use the design-system input box (border, rounded). Alternatives: replicate borderless (rejected: controls not identifiable); underline only (rejected: not in the design system). No copy, order or behaviour change. | Approved |
| DV-M21-17 | - | Language (BM copy) | Mohon Keluarga Angkat form: "Email Pelajar", "Email pelajar tidak dijumpai ...", "sebagai template", "pool" | "Emel Pelajar", "Emel pelajar tidak dijumpai ...", "sebagai templat", "kumpulan". | Approved: user decision 2026-10-24 (system audit FB-025) |

**Deviation count:** 10 approved (01, 02, 03, 05, 06, 07, 08, 12, 14, 16), 6 rejected / replicate live (04, 09, 10, 11, 13, 15).

### 7.1 Count reconciliation (summary)

Every figure of discovery §5.1 was recomputed by hand from the seed (SRS §6.9, checks R01–R14, all pass): **(a) computed from M21's own stores** — S1 cards 6 / 0 / 0 / 0 / 6 and the 11 filter results (suspended 6, pending / approved / rejected 0, Syarikat Swasta 6, Individu 0, "Kedai" 1, "zzqxv" 0, page 2 empty with count 6); S1 order #11, #6–#10; S4 cards 1 / 1 / 0 / 0 and tabs 1 / 1 / 0 / 0 / 0; S4 select empty; S5 tabs 3 / 0 / 0 / 0 and order #3, #2, #1; M17 cards 6 · 0 Aktif · 0 · 0 · 6 through the M21 contract; **(b) other owners' contracts** — M02 sponsor users 6 (one per sponsor), S3 "Hadiah" 0 on all 6 (M15); **(c) D9 fixes** — DV-M21-03 changes the S4 "Semua" figure on the Graduated / Withdrawn / Expired tabs from 0 to 1 (the total; no new contradiction); no other figure changes. No display constant is used.

---

## 8. Out of scope

| Item | Owner / reason |
|---|---|
| Users (logins, names, e-mails, roles), parent↔child links, login, landing pages, global 404 / 403 pages | M01 / M02 (read and created through their contract; XR-M21-01 / 02) |
| M17 dashboard cards | M17 (reads the M21 sponsor summary; XR-M21-03) |
| Kedai Hadiah and any sponsor-supplied reward, `/sponsor/rewards` content | M15 (not observable; XR-M21-04, OQ-M21-08) |
| Free access "selama 1 sesi persekolahan" (entitlement), payments | M19 (not written by M21; XR-M21-05, OQ-M21-08) |
| "Via Agent" agents / ambassadors | M24 (XR-M21-06) |
| Sponsor portal beyond the PROPOSED minimum (dashboard, reports, profile editing, rewards) | Not observable (OQ-M21-01); not built until observed or decided |
| Suspending, deleting or re-approving sponsors; editing or deleting anak-angkat records or applications; full reason view | Not observable (OQ-M21-02 / 05 / 06); not built |
| Automatic expiry of sponsorships | Not observable (OQ-M21-11) |
| E-mail or push notifications | M22 / D14 (simulated only; XR-M21-10) |
| Global shells, header chips, bell, chatbot, tournament banner | global shell / M23, M14, M22, M16 |
| Real server-side authorisation, CSRF, rate limiting, password hashing, audit trail | backend phase (SRS §11.1) |

---

## 9. Open questions

1. **OQ-M21-01 Sponsor portal and sponsor landing (discovery OQ-M21-01, C5) — RESOLVED at G1 (2026-09-27): "Bina minimum", approved; stays labelled PROPOSED (approved at G1); US-M21-20 / 21, AC-M21-20 / 21 and the related FR / E2E stay in scope.** `/sponsor`, `/sponsor/anak-angkat`, `/sponsor/anak-angkat/pool`, `/sponsor/rewards` and `POST /sponsor/profile` are 403 for the admin; their content is unknown. The rebuild builds only what the pool flow needs (EP-M21-6: "Anak Angkat Saya", "Pool Pelajar" with "Taja"; `/sponsor` → `/sponsor/anak-angkat`; `/sponsor/rewards` → `/sponsor/anak-angkat`) and asks M01 to land sponsors on `/sponsor` (XR-M21-02). The user may prefer not to build the portal until a sponsor account is observed (then the pool → "Ditaja" step and AC-M21-20 / 21 are dropped).
2. **OQ-M21-02 Status actions for pending / approved / rejected sponsors (discovery OQ-M21-02) — RESOLVED at G1 (2026-09-27): only "Luluskan" and "Tolak", approved; stays labelled PROPOSED (approved at G1).** Only "Luluskan" / "Tolak" on a pending sponsor are PROPOSED (FN-M21-2.3.7); no suspend, re-approve or delete action.
3. **OQ-M21-03 Flash, validation messages and the S7 success outcome (discovery OQ-M21-03).** None observed; the rebuild shows no flash after admin actions and uses the PROPOSED COPY of SRS §8.2 for validation errors, the S6 success notice and the S7 success panel.
4. **OQ-M21-04 Student search results (discovery OQ-M21-04).** The row layout is SOURCE-DERIVED from the live template (name; "{e-mail} · {school}" when a school exists; AUD-M21-01). Only which users are searchable and the result limit are unknown; PROPOSED: students only, name or e-mail contains the query, at most 10 results (FN-M21-3.1.3).
5. **OQ-M21-05 Rows in the other statuses (discovery OQ-M21-05).** Badges "Graduated" / "Withdrawn" / "Expired" / "Approved" / "Matched" / "Rejected" and their colours are INFERRED; no action on those rows (PROPOSED).
6. **OQ-M21-06 Full application reason (discovery OQ-M21-06).** Live shows only the first 80 characters; replicated without a full view.
7. **OQ-M21-07 Who may apply (discovery OQ-M21-07).** S6 opens for every signed-in role (INFERRED from its copy); the menu entry stays student / admin as the live menus. Confirm whether parents and teachers should see the menu entry (adding it would be new scope).
8. **OQ-M21-08 Hadiah, free access and "Via Agent" (discovery OQ-M21-08, C6–C8).** "Hadiah" reads M15 (0 today); the free access for 1 school session is **not** granted by the prototype until M19 decides (XR-M21-05); "Via Agent" stores only the channel (XR-M21-06).
9. **OQ-M21-09 Page size (discovery OQ-M21-09).** PROPOSED 20 for S1, S4 and S5 (any size ≥ 6 reproduces live).
10. **OQ-M21-10 "Jumlah Penaja" definition (C2).** Specified as "sponsors with at least one anak-angkat record, any status"; "with an active record" fits the observation equally (Perlu pengesahan).
11. **OQ-M21-11 Expiry.** The status `expired` exists (tab "Expired") but no trigger was observed; the prototype never sets it automatically.
12. **OQ-M21-12 Duplicates.** Whether one student may have two pending applications or two active sponsorships is unknown; no duplicate rule is built (live data shows none).
13. **OQ-M21-13 PROPOSED items — reported at G1 (2026-09-27; OQ-01 and OQ-02 items approved by the user; same list as SRS §8.2):** the sponsor portal minimum and its copy ("Anak Angkat Saya", "Pool Pelajar", "Taja", "Taja pelajar ini?", "Tiada pelajar dalam pool"); the sponsor landing `/sponsor`; "Luluskan" / "Tolak" and their confirms on a pending sponsor; the create / update / assign / submit effects and landing pages (no flash text after admin actions); the validation messages; the S6 success notice; the S7 success panel; the student-search result limit (≤ 10) and scope (students only); the "{label} ({code})" status-card pattern for statuses other than SUSPENDED (INFERRED); the badges of unobserved statuses; the S5 pending empty text; the page size 20; the simulated e-mail log (D14).
