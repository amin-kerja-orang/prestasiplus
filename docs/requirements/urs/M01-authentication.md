# M01 — Authentication & Account — User Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | URS — M01 Authentication & Account |
| Version | 1.13 |
| Date | 2026-10-02 |
| Status | Approved (G1) — v1.13, as-built deviation records DV-14 extension and DV-19 (G4 reviews T5a/T6/T7a); no scope change |
| Author | product-analyst (agent) |
| Source discovery | [M01-authentication.md](../../discovery/M01-authentication.md) (incl. "added in inventory pass" items), element inventory [`inventory/M01/`](../../discovery/inventory/M01/) (`S*.json`, `SHU-user-shell.json`, `SHA-admin-shell.json`, `_crawl.json`, `_summary.md`), global shell [00-global-ui.md](../../discovery/00-global-ui.md), screenshots `docs/discovery/img/M01/` |
| Companion SRS | [srs/M01-authentication.md](../srs/M01-authentication.md) |

**Change log**

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-09-25 | First draft (superseded: it proposed behaviour changes that D7 no longer allows). |
| 0.2 | 2026-09-25 | Full rewrite under D7 (fidelity) and D8 (proven completeness). Epic → Feature → Function breakdown from the element inventory. Stories are linked to Functions. The coverage matrix maps every inventory element. The only intended differences from the live site are listed in §7 "Fidelity deviations". All v0.1 "Decisions needed" proposals are withdrawn. |
| 1.1 | 2026-09-25 | **Revision history — v1.1, audit fixes** (`docs/qa/audit/M01-audit.md`). AUD-M01-01: static bio counter. AUD-M01-02: DV-09 and AC-26.4 withdrawn. AUD-M01-03: "Padam" tooltip. AUD-M01-04: badge refresh on load, every 60 s and on push (new AC-22.3). AUD-M01-05: 🎒 moved to the welcome panel. AUD-M01-06: uppercase level-group headings. AUD-M01-07: seed (SRS). AUD-M01-08: 120 min session OBSERVED. AUD-M01-09: zero-count badge OBSERVED, OQ-7 narrowed. AUD-M01-10: DV-06 evidence. AUD-M01-11: DV-11…DV-15 default to replicating live and need a user decision. AUD-M01-12: district wording. |
| 1.2 | 2026-09-25 | **Revision history — v1.2, user decision (rule D9: fix what is broken or contradictory, replicate what works).** Approved: DV-01…08, DV-10, DV-11, DV-12, DV-13, DV-14; their fixes are now the specified behaviour. Rejected: DV-15 (replicate live). DV-09 stays withdrawn. Status Approved (G1). |
| 1.3 | 2026-09-25 | **Revision history — v1.3, cross-module alignment with M02** (`docs/discovery/M02-users-schools.md`, `srs/M02-users-schools.md` Q3 / URS OQ-12). The role codes are corrected to the 8 observed codes (`student, teacher, parent, sponsor, school_admin, ppd_officer, jpn_officer, admin`); the inferred `ppd`/`jpn`/`duta`/`seller`/`tuition_centre` are dropped. Inactive users are refused at login (new FN-M01-1.2.15, AC-M01-01.6). The IC is hidden only on self/non-admin endpoints. The User entity references M02. Parent linking and school types are answered by M02. |
| 1.4 | 2026-09-25 | **Revision history — v1.4, cross-module alignment with M02 (school search).** No functional change: the SRS school-search contract is aligned with the M02 audit (default 20, no maximum, `id` param). Inactive-login refusal, IC scope and INFERRED landing pages (OQ-3) are already covered. |
| 1.5 | 2026-09-25 | **Revision history — v1.5, cross-module alignment (integer user ids).** No functional change. The SRS now uses integer ids for User, Notification and School, and fixes the seed ids (admin = 1). |
| 1.6 | 2026-09-25 | **Revision history — v1.6, cross-module logic review fixes.** XL-02: the login stats source is stated (DV-05 row, AC-02.3). XL-22: new DV-16 (text below 12px raised to 12px) and AC-26.7. XL-20: DV-13 references the shell rule. Seed and dataset fixes are in the SRS. **Addendum (v1.6, wording only):** the admin grade Darjah 4 is confirmed OBSERVED (SRS §6.8). |
| 1.7 | 2026-09-25 | **Revision history — v1.7, user-id alignment with M02 v1.4.** No functional change: the SRS now states that runtime-created users get ids from 9,000,001 upward, in creation order, never reused (owner: M02 SRS §6.15). |
| 1.8 | 2026-09-25 | **Revision history — v1.8, XL round 2.** XL-02: DV-05 and AC-02.3 now cite the named query Q-ELIGIBLE (M04 SRS §4.1) instead of "the M04 total / M17 Soalan Aktif". XL-38: school seeding moved to M02 (SRS §6.8). |
| 1.9 | 2026-09-26 | **Revision history — v1.9, XL batch 2 (XL2-07).** No user-visible change: the SRS adds `User.lastLoginAt`, set on each successful login and read by M02/M11. |
| 1.10 | 2026-09-27 | **Revision history — v1.10.** New AC-M01-01.7 (M14 login hook, INFERRED) and AC-M01-06.5 (provisional referral carry of `?ref=`; the register UI is unchanged). FN-M01-1.2.8 and FN-M01-1.4.16 are updated to match. Seed school and F-11 as-built changes are in the SRS. |
| 1.11 | 2026-09-27 | **Revision history — v1.11.** No URS change: the SRS canonical seed sets account 4's school to 900004 "SK Demo Bestari" (XL3 R2-01). |
| 1.12 | 2026-09-30 | **Revision history — v1.12, privacy rule.** The register name placeholder (FN-M01-1.4.3, AC-M01-06.2, EL-M01-S2-029) is replaced with the generic "Muhammad Fulan bin Fulan"; new DV-17 in §7. The S5 IC example (FN-M01-1.7.3, AC-M01-12.1, EL-M01-S5-009) is replaced with the fictitious `000101010000` (new DV-18). No other change. |
| 1.13 | 2026-10-02 | **Revision history — v1.13, as-built decisions from the G4 reviews of M01-T5a, T6 and T7a (doc-only).** DV-14 is extended to the S7 hero email and "Ahli sejak" lines (FN-M01-2.1.2, AC-M01-14.2 wording aligned); new DV-19 (S8 Tahap Darjah grid is 3 columns below 360px). Details in SRS v1.15. No Function, AC count or scope change. |

**Conventions**
- Quoted UI copy is the exact live text: Bahasa Melayu (BM), or English where the live site shows English (for example the pagination summary, or browser-native validation bubbles).
- **OBSERVED** = seen on the live site (discovery walkthrough or inventory). **INFERRED** = the live site does it but it could not be observed read-only (post-submit results, non-admin roles). For INFERRED behaviour, the most likely live behaviour is specified (Laravel defaults where they apply), and nothing new is invented.
- **UNVERIFIED COPY** = the text of a message the live site shows after a submit, which could not be captured. The prototype uses the stated placeholder until the text is verified (§9 OQ-1).
- **DV-nn** = a fidelity deviation (§7; see its Status column). Anything not listed in §7 must match the live site.

---

## 1. Overview

M01 covers how people get into PrestasiPlus and manage their own account:
- guests log in, register as Pelajar / Guru / Ibu Bapa, and recover a password by emailed link or by email + IC number;
- logged-in users view and edit their profile (details, picture, school, password), set personal spiritual/faith preferences, read and manage their notification inbox, and log out;
- after login, the user is sent to their role's landing page.

The rebuild replicates the live behaviour exactly (D7). It is a front-end prototype with dummy data and a mock service layer (D1, D2).

**Routes covered** (`docs/TRACKER.md` §4, M01):

| # | Route | Screen / behaviour |
|---|---|---|
| S1 | `/login` | Log Masuk |
| S2 | `/register` | Daftar |
| S3 | `/password/reset` | Lupa Kata Laluan (request email link; form posts to `/password/email`) |
| S4 | `/password/reset/{token}` | Reset Kata Laluan (set new password) |
| S5 | `/password/reset-ic` | Reset Melalui No IC |
| S6 | `/logout` | Log out (GET link; action, not a screen) |
| S7 | `/profile` | Profil Saya |
| S8 | `/profile/edit` | Kemaskini Profil (details, picture, school, password) |
| S9 | `/tetapan` | Tetapan Peribadi |
| S10 | `/settings` | The live 404 page ("Halaman Tidak Dijumpai"), reached from the mobile drawer's dead "Tetapan" link (DV-01) |
| S11 | `/notifikasi` | Notifikasi / Peti Masuk (inbox screen; M22 owns sending notifications) |
| S12 | (behaviour) | Redirect after login by role; route guards |
| — | Shell elements | Account entries in the shells: header bell + unread badge, "Profil Saya" / "Tetapan Peribadi" / "Tetapan" links, user identity blocks, "Log Keluar" controls |

## 2. Actors

| Role | Involvement in M01 | Verified |
|---|---|---|
| Guest | Uses S1–S5: login, register, both password resets. Protected routes send guests to `/login`. | Yes (cookie-less session captured) |
| Pelajar (student) | Self-registers with a level (and optionally an IC number and a school). Uses S6–S11. Can use the IC reset only if an IC was stored. | Inferred (register form observed; no student account) |
| Guru (teacher) | Self-registers without level or IC. Uses S6–S11. | Inferred |
| Ibu Bapa (parent) | Self-registers without IC. On the live site a script conflict also shows the level picker to parents (see DV-06). Uses S6–S11. | Inferred |
| Admin | Logs in, lands on `/admin`. Uses S6–S11. `/tetapan` renders inside the admin shell. | Yes (admin account) |
| Penaja (`sponsor`), Admin Sekolah (`school_admin`), Pegawai PPD (`ppd_officer`), Pegawai JPN (`jpn_officer`) | Cannot self-register on `/register`: these accounts are created by an admin in M02 (Penaja also has `/sponsor/register`, owned by M21). Log in on `/login`; landing page per SRS BR-07 (INFERRED). Use S6–S11. Role codes are OBSERVED in M02 (8 codes in total with student, teacher, parent, admin). Duta, Penjual and Pusat Tuisyen are **not** user role codes on the live site (M02 R2); their areas belong to M24, M20 and M26. | Codes observed (M02); M01 behaviour inferred |

URS.md §6 corrections: none. Admin is confirmed for login and the account pages. The other roles remain inferred.

---

## 3. Functional breakdown (Epic → Feature → Function)

Derived from the element inventory and the behaviour probes. "EL" lists inventory element IDs (prefix `EL-M01-`). Functions with no EL are behaviours (redirects, post-submit results) with no element of their own.

### EP-M01-1 — Account access (guest authentication)

**FT-M01-1.1 — Auth page layout** (shared by S1–S5)

| FN | Function | Screen | EL | Roles | Source |
|---|---|---|---|---|---|
| FN-M01-1.1.1 | Animated pastel gradient background, SVG wave, floating decorative emoji 📚 ✏️ ⭐ 🎨 🚀 💡 (visible at every width) | S1, S2 | S1-001–006; S2-001–006 | Guest | OBSERVED |
| FN-M01-1.1.2 | White form card with logo (`/images/logo-custom.png`, alt "PRESTASIPLUS") and card tagline ("Platform Latih Tubi Nasional 🇲🇾" on login, "Daftar Akaun Baru 🇲🇾" on register) | S1, S2 | S1-020–022; S2-020–022 | Guest | OBSERVED |
| FN-M01-1.1.3 | Footer "© 2026 PRESTASIPLUS. Platform Pendidikan Malaysia." | S1–S5 | S1-046; S2-082; S3-013; S4-020; S5-015 | Guest | OBSERVED |

**FT-M01-1.2 — Login** (S1 `/login`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M01-1.2.1 | Welcome panel (desktop only): mascot 🎓, "Selamat Kembali! 👋", dynamic text with the question and subject counts, 3 feature tiles | S1-007–019 | Guest | OBSERVED |
| FN-M01-1.2.2 | "Alamat Email" input (`email`, type email, placeholder `nama@email.com`, required, autocomplete email, `@` icon) | S1-025–026 | Guest | OBSERVED |
| FN-M01-1.2.3 | "Kata Laluan" input (`password`, placeholder `••••••••`, required, autocomplete current-password) | S1-027–028 | Guest | OBSERVED |
| FN-M01-1.2.4 | Show/hide password toggle (icon `fa-eye` ↔ `fa-eye-slash`) | S1-029 | Guest | OBSERVED |
| FN-M01-1.2.5 | "Ingat saya" checkbox (`remember`, unticked by default) | S1-030–031 | Guest | OBSERVED |
| FN-M01-1.2.6 | Link "Lupa kata laluan?" → `/password/reset` | S1-032 | Guest | OBSERVED |
| FN-M01-1.2.7 | Link "Reset melalui No IC" (`fa-id-card`) → `/password/reset-ic` | S1-033 | Guest | OBSERVED |
| FN-M01-1.2.8 | Submit "Log Masuk" (`fa-sign-in-alt`), `POST /login` with CSRF token. Loading state: disabled button with `fa-circle-notch` + "Sedang Memasuki..." After a successful login, the M14 login hook runs (streak / daily login, INFERRED) | S1-023–024, 034–036, 047 | Guest | OBSERVED |
| FN-M01-1.2.9 | Browser-native HTML5 validation (required, email format), in the browser's own language | (attributes of S1-026, 028) | Guest | OBSERVED |
| FN-M01-1.2.10 | Invalid-credentials alert "Email atau kata laluan tidak sah." (email kept, password cleared) | — (screenshot `login-error-desktop.png`) | Guest | OBSERVED |
| FN-M01-1.2.11 | Login throttling after repeated failures | — | Guest | INFERRED (Laravel default) |
| FN-M01-1.2.12 | "Belum ada akaun? Daftar Sekarang 🚀" → `/register` | S1-037–038 | Guest | OBSERVED |
| FN-M01-1.2.13 | "Kembali ke Laman Utama" (`fa-arrow-left`) → `/` | S1-039 | Guest | OBSERVED |
| FN-M01-1.2.14 | Stats strip "❓ {soalan}+ Soalan • 📚 {subjek} Subjek • 🎓 {tahap} Tahap" | S1-040–045 | Guest | OBSERVED (DV-05 for the value source) |
| FN-M01-1.2.15 | Inactive account refused at login: a user whose account is set inactive by an admin (M02 toggle-active, "Pengguna yang tidak aktif tidak boleh log masuk") cannot log in, and the login alert shows a refusal message | — | All | INFERRED (rule OBSERVED in M02 copy; message UNVERIFIED COPY) |

**FT-M01-1.3 — Session and redirects** (S12)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M01-1.3.1 | Redirect after login by role: admin → `/admin`. The intended URL is ignored, and there is no flash message. | — | All | OBSERVED (admin); INFERRED (others) |
| FN-M01-1.3.2 | Session lifetime: without "Ingat saya" the session and XSRF cookies expire 120 min (2 h) after the last response, with no remember cookie. With "Ingat saya", a long-lived remember cookie keeps the user logged in | — | All | OBSERVED (120 min cookie expiry) / INFERRED (remember duration) |
| FN-M01-1.3.3 | Guard: a guest opening a protected route (or an account JSON endpoint) is redirected to `/login` with no message | — | Guest | OBSERVED |
| FN-M01-1.3.4 | No guest-only guard: `/login` and `/register` render normally for logged-in users (same content, no notice) | — | All | OBSERVED |

**FT-M01-1.4 — Registration** (S2 `/register`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M01-1.4.1 | Welcome panel (hidden on mobile, like login's): mascot bubble 🎒, "Sertai Kami! 🌟", text, 3 tiles | S2-007–019 | Guest | OBSERVED |
| FN-M01-1.4.2 | Decorative step indicator "1 — 2 — 3" (static; step 1 always active; not interactive) | S2-023–025 | Guest | OBSERVED |
| FN-M01-1.4.3 | "Nama Penuh" (`name`, placeholder `Muhammad Fulan bin Fulan`, required) | S2-028–029 | Guest | OBSERVED |
| FN-M01-1.4.4 | "Alamat Email" (`email`, type email, placeholder `nama@email.com`, required) | S2-030–031 | Guest | OBSERVED |
| FN-M01-1.4.5 | "No. Telefon (Pilihan)" (`phone`, type tel, placeholder `Cth: 0191234567`, maxlength 14) | S2-032–033 | Guest | OBSERVED |
| FN-M01-1.4.6 | "Saya adalah..." role cards: Pelajar (default) / Guru / Ibu Bapa → hidden `role` | S2-034–038 | Guest | OBSERVED |
| FN-M01-1.4.7 | "Pilih Tahap Anda" grade picker (Pelajar only): sub-headings displayed "SEKOLAH RENDAH" (Darjah 1–6, values 1–6) and "SEKOLAH MENENGAH" (Ting. 1–5, values 7–11). The source text is "Sekolah Rendah" / "Sekolah Menengah", uppercased by CSS → hidden `grade` | S2-039–055 | Guest | OBSERVED (DV-06 for parents) |
| FN-M01-1.4.8 | "No. Kad Pengenalan (Pilihan)" (Pelajar only; `ic_number`, placeholder `Cth: 031215101234`, maxlength 14, numeric keypad) + PDPA hint | S2-056–058 | Guest | OBSERVED (DV-04) |
| FN-M01-1.4.9 | "Sekolah (Pilihan)" picker: state select + search + dropdown (max 15) + empty state + selected chip + clear → hidden `school_id` | S2-059–066, 084–086 | Guest | OBSERVED |
| FN-M01-1.4.10 | "Kata Laluan" + toggle + hint "Minimum 6 aksara" | S2-067–070 | Guest | OBSERVED (DV-03) |
| FN-M01-1.4.11 | "Sahkan Kata Laluan" + its own toggle | S2-071–073 | Guest | OBSERVED |
| FN-M01-1.4.12 | Submit "Daftar Sekarang" (`fa-user-plus`), `POST /register`. Loading: disabled + "Sedang Mendaftar..." | S2-026–027, 074–076, 083 | Guest | OBSERVED |
| FN-M01-1.4.13 | "Sudah ada akaun? Log Masuk 🔑" → `/login` | S2-077–078 | Guest | OBSERVED |
| FN-M01-1.4.14 | "Mewakili organisasi? Daftar sebagai Penaja" (`fa-handshake`) → `/sponsor/register` (M21) | S2-079–080 | Guest | OBSERVED |
| FN-M01-1.4.15 | "Kembali ke Laman Utama" (`fa-home`) → `/` | S2-081 | Guest | OBSERVED |
| FN-M01-1.4.16 | Query parameters `?role=` and `?ref=` do not change the form (Pelajar stays selected; no extra field; OBSERVED). A `?ref=` code is kept in the background and sent with the registration for M14 referral credit (provisional, INFERRED; M14 XR-M14-02) | — | Guest | OBSERVED (UI) / INFERRED (referral carry) |
| FN-M01-1.4.17 | Successful registration: account created, user logged in, redirected to the landing page | — | Guest | INFERRED (Laravel default) |
| FN-M01-1.4.18 | Server-side validation failure: back to `/register` with errors and old input (passwords cleared) | — | Guest | INFERRED (Laravel default) |

**FT-M01-1.5 — Forgot password by email** (S3 `/password/reset`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M01-1.5.1 | Card header: 🔑, "Lupa Kata Laluan?", "Masukkan email anda dan kami akan hantar pautan untuk reset kata laluan." | S3-001–004 | Guest | OBSERVED |
| FN-M01-1.5.2 | "Alamat Email" (`email`, required, autofocus, placeholder `nama@email.com`) | S3-007–008 | Guest | OBSERVED |
| FN-M01-1.5.3 | Submit "Hantar Pautan Reset" (`fa-paper-plane`), `POST /password/email`. Loading: disabled + "Menghantar..." | S3-005–006, 009–011, 014 | Guest | OBSERVED |
| FN-M01-1.5.4 | "Kembali ke Log Masuk" (`fa-arrow-left`) → `/login` | S3-012 | Guest | OBSERVED |
| FN-M01-1.5.5 | Result after submit: status message, or an error for an unknown email / throttle | — | Guest | INFERRED (Laravel password broker) |

**FT-M01-1.6 — Set new password by token** (S4 `/password/reset/{token}`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M01-1.6.1 | Card header: 🔒, "Reset Kata Laluan", "Masukkan kata laluan baru anda." | S4-001–004 | Guest | OBSERVED |
| FN-M01-1.6.2 | Hidden `token` from the URL. The form renders for any token; the token is checked on submit | S4-007 | Guest | OBSERVED / INFERRED (check) |
| FN-M01-1.6.3 | "Alamat Email" pre-filled from `?email=` (empty and editable when absent; required) | S4-008–009 | Guest | OBSERVED |
| FN-M01-1.6.4 | "Kata Laluan Baru" (placeholder "Minimum 6 aksara", new-password) + toggle | S4-010–012 | Guest | OBSERVED (DV-03) |
| FN-M01-1.6.5 | "Sahkan Kata Laluan" (placeholder "Taip semula kata laluan") + toggle | S4-013–015 | Guest | OBSERVED |
| FN-M01-1.6.6 | Submit "Tukar Kata Laluan" (`fa-check-circle`), `POST /password/reset`. Loading: disabled + "Menukar..." | S4-005–006, 016–018, 021 | Guest | OBSERVED |
| FN-M01-1.6.7 | "Kembali ke Log Masuk" (`fa-arrow-left`) → `/login` | S4-019 | Guest | OBSERVED |
| FN-M01-1.6.8 | Result after submit (password reset + login + redirect, or an invalid-token error) | — | Guest | INFERRED (Laravel default) |

**FT-M01-1.7 — Reset by email + IC** (S5 `/password/reset-ic`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M01-1.7.1 | Card header: indigo `fa-id-card` icon, "Reset Melalui No IC", "Masukkan email dan No Kad Pengenalan yang didaftarkan dalam profil anda." | S5-001–003 | Guest | OBSERVED |
| FN-M01-1.7.2 | "Alamat Email" (required, autofocus) | S5-006–007 | Guest | OBSERVED |
| FN-M01-1.7.3 | "No Kad Pengenalan" (`ic_number`, placeholder `000101010000`, required) + hint "Tanpa tanda sempang (-). Contoh: 000101010000" | S5-008–010 | Guest | OBSERVED (DV-04 for maxlength) |
| FN-M01-1.7.4 | Submit "Reset Kata Laluan" (`fa-unlock-alt`), `POST /password/reset-ic`. Loading: disabled + "Memproses..." | S5-004–005, 011–013, 016 | Guest | OBSERVED |
| FN-M01-1.7.5 | "Kembali ke Log Masuk" (`fa-arrow-left`) → `/login` | S5-014 | Guest | OBSERVED |
| FN-M01-1.7.6 | Result after submit (match → set-new-password form; no match → error) | — | Guest | INFERRED |

**FT-M01-1.8 — Logout** (S6)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M01-1.8.1 | Logout controls: user shell sidebar user block icon + header icon (desktop, title "Log Keluar"); user drawer "Log Keluar" (<1024); admin sidebar footer icon + header icon (desktop); admin "Lagi" menu "Log Keluar" (<1024) | SHU-134, 147, 317; SHA-117, 130, 195 | All authenticated | OBSERVED |
| FN-M01-1.8.2 | `GET /logout`: ends the session and redirects to `/login` with no message and no confirmation | — | All authenticated | OBSERVED |

### EP-M01-2 — My account

**FT-M01-2.1 — View profile** (S7 `/profile`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M01-2.1.1 | Shell header "Profil Saya" / "Statistik & Pencapaian Anda" | SHU-136–137 | All authenticated | OBSERVED |
| FN-M01-2.1.2 | Hero card: generated initials avatar (with orange crown badge), name in white text (DV-14; live slate-800 is unreadable on the gradient), email in white (DV-14 extension, live colour not recorded), "Ahli sejak {d MMMM yyyy}" (`fa-calendar-alt`) | S7-004–007 | All authenticated | OBSERVED (admin) |
| FN-M01-2.1.3 | "Kemaskini Profil" (`fa-pen`) → `/profile/edit` | S7-008 | All authenticated | OBSERVED |

**FT-M01-2.2 — Edit profile** (S8 `/profile/edit`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M01-2.2.1 | Shell header "Kemaskini Profil" / "Maklumat peribadi & sekolah anda" | SHU-373–374 | All authenticated | OBSERVED |
| FN-M01-2.2.2 | "Gambar Profil" card: 96px avatar, hover overlay (black 40%, `fa-camera`) that opens the file picker, "Pilih Gambar" label, hint "JPG, PNG atau WEBP. Maks 2MB." | S8-004–007, 011, 013 | All authenticated | OBSERVED |
| FN-M01-2.2.3 | Choose file (`profile_picture`, accept jpeg/png/webp) → client-only preview replaces the avatar and reveals "Simpan" (`fa-check`). Pressing it submits `POST /profile/picture` (multipart). No auto-submit | S8-008–010, 012 | All authenticated | OBSERVED (preview) / INFERRED (result) |
| FN-M01-2.2.4 | "Maklumat Peribadi" card + "Nama Penuh" (`name`, pre-filled, required) | S8-017–020 | All authenticated | OBSERVED |
| FN-M01-2.2.5 | "Email" read-only/disabled + "Email tidak boleh diubah" | S8-021–023 | All authenticated | OBSERVED |
| FN-M01-2.2.6 | "No. Telefon" (`phone`, type tel, placeholder `012-3456789`) | S8-024–025 | All authenticated | OBSERVED |
| FN-M01-2.2.7 | "Bio / Motto" (`bio`, placeholder "Tulis sesuatu tentang diri anda...", maxlength 500) + a **static** counter that always reads "Baki: 500 aksara" (it never updates, whatever the bio contains, because its script reference `$refs.bioInput` is not bound on the live page) | S8-026–028 | All authenticated | OBSERVED |
| FN-M01-2.2.8 | "Tahap" radio cards under the sub-heading displayed "SEKOLAH RENDAH" (source text "Sekolah Rendah", uppercased by CSS): Darjah 1–6, current one checked and highlighted | S8-029–042 | All authenticated | OBSERVED (admin) / INFERRED (group rule) |
| FN-M01-2.2.9 | "Maklumat Sekolah" card, "Pilih sekolah anda untuk sambung dengan rakan sekelas", selected-school chip (NAME, type · state · PPD, separators only when present) + clear (`fa-times-circle`) → hidden `school_id` | S8-043–052, 058 | All authenticated | OBSERVED |
| FN-M01-2.2.10 | School search when cleared: "Semua Negeri" + 16 states, search "Taip nama sekolah (min. 2 huruf)...", dropdown (max 20, `fa-school` rows), empty state; no "searching" indicator; errors are silent | S8-053–057, 073–074 | All authenticated | OBSERVED |
| FN-M01-2.2.11 | "Kembali" (`fa-arrow-left`) → `/profile` | S8-059 | All authenticated | OBSERVED |
| FN-M01-2.2.12 | "Simpan Profil" (`fa-save`) submits `POST /profile` (`_method=PUT`: name, phone, bio, grade, school_id), then shows the result | S8-014–016, 060 | All authenticated | OBSERVED (form) / INFERRED (result) |
| FN-M01-2.2.13 | "Tukar Kata Laluan" card: "Kata Laluan Semasa", "Kata Laluan Baharu" + hint "Sekurang-kurangnya 8 aksara" (DV-03), "Sahkan Kata Laluan Baharu"; no toggles, no HTML `required` | S8-061–062, 065–071 | All authenticated | OBSERVED |
| FN-M01-2.2.14 | Submit "Tukar Kata Laluan" (`fa-shield-alt`), `POST /profile/password`, then shows the result | S8-063–064, 072 | All authenticated | OBSERVED (form) / INFERRED (result) |

**FT-M01-2.3 — Personal settings** (S9 `/tetapan`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M01-2.3.1 | Hero "⚙️ Tetapan Peribadi" + "Atur pengalaman PrestasiPlus mengikut keperluan rohani & masa anda." | S9-001–002 | All authenticated | OBSERVED |
| FN-M01-2.3.2 | Card "🕌 Mod Rohani" + intro | S9-006–007 | All authenticated | OBSERVED |
| FN-M01-2.3.3 | Checkbox "Aktifkan Mod Rohani" (`spiritual_mode`, value 1) + description | S9-008–009 | All authenticated | OBSERVED |
| FN-M01-2.3.4 | Checkbox "Tunjuk doa sebelum quiz" (`show_bismillah_splash`) + description | S9-010–011 | All authenticated | OBSERVED |
| FN-M01-2.3.5 | Checkbox "Push waktu Subuh" (`subuh_push_enabled`) + description + time input (`subuh_push_time`, default 05:30) | S9-012–014 | All authenticated | OBSERVED |
| FN-M01-2.3.6 | Checkbox "Mod Ramadan" (`ramadan_mode_enabled`) + description + time input (`sahur_push_time`, default 04:30) | S9-015–017 | All authenticated | OBSERVED |
| FN-M01-2.3.7 | Card "🌍 Latar Agama (opsyen)" + intro + "Agama / kepercayaan" select (`faith`, 6 options) + description | S9-018–021 | All authenticated | OBSERVED |
| FN-M01-2.3.8 | Page shell: for admin, the admin shell, whose header shows "Tetapan Peribadi" (DV-13; live wrongly shows "Dashboard" / "Selamat datang, Admin") | SHA-118–119 | All authenticated | OBSERVED (admin) / INFERRED (others) |
| FN-M01-2.3.9 | "💾 Simpan Tetapan" submits `POST /tetapan` (`_method=PUT`), then shows the result. No client-side dependencies between controls | S9-003–005, 022 | All authenticated | OBSERVED (form) / INFERRED (result) |

**FT-M01-2.4 — `/settings` link and 404 page** (S10)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M01-2.4.1 | User-shell mobile drawer link "Tetapan" (`fa-cog`) → `/settings` (dead link; DV-01) | SHU-315 | All authenticated (<1024) | OBSERVED |
| FN-M01-2.4.2 | 404 page: "404", 🔍, "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama" → `/`, caption "PRESTASIPLUS"; title "404 - Halaman Tidak Dijumpai \| PRESTASIPLUS"; no shell | S10-001–005, 007 | All | OBSERVED |
| FN-M01-2.4.3 | 404 page link "Mula Latihan" → `/latih-tubi` (itself a 404; DV-02) | S10-006 | All | OBSERVED |

**FT-M01-2.5 — Account entries in the shells**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M01-2.5.1 | Navigation links: user sidebar "Tetapan Peribadi" → `/tetapan` and "Profil Saya" → `/profile` (desktop); user drawer "Tetapan Peribadi" and "Profil Saya" (<1024); admin sidebar "Tetapan Peribadi" (desktop) | SHU-025, 119, 228, 314; SHA-111 | All authenticated | OBSERVED |
| FN-M01-2.5.2 | Identity display: user sidebar card (avatar, name, email), user header avatar (desktop), drawer user card (avatar, name, role code e.g. "admin"); admin sidebar card (avatar, name, role label "Admin"), admin header avatar | SHU-130–133, 146, 167–169; SHA-113–116, 129 | All authenticated | OBSERVED |

### EP-M01-3 — Notifications inbox

**FT-M01-3.1 — Header bell**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M01-3.1.1 | User-shell header bell (`fa-bell`, title "Notifikasi") → `/notifikasi`, with a red unread-count badge (server-rendered first, capped at "99+", hidden when the count is 0). `updateNotifBadge()` refreshes it from `GET /notifikasi/unread-count` on page load, every 60 s (`setInterval`), and when a foreground push message arrives (push delivery is owned by M22) | SHU-144–145 | All authenticated (user shell) | OBSERVED (page script) |

**FT-M01-3.2 — Inbox list** (S11 `/notifikasi`)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M01-3.2.1 | Shell header "Notifikasi" / "Peti masuk mesej anda" | SHU-375–376 | All authenticated | OBSERVED |
| FN-M01-3.2.2 | Title "Peti Masuk" + red unread-count pill | S11-004–005 | All authenticated | OBSERVED |
| FN-M01-3.2.3 | "Tanda semua dibaca" (`fa-check-double`), form `POST /notifikasi/read-all`. Hidden in select mode; still shown on empty lists | S11-006–008 | All authenticated | OBSERVED (UI) / INFERRED (result) |
| FN-M01-3.2.4 | "Pilih" (`fa-check-circle`) enters select mode. Hidden in select mode and not rendered when the list is empty | S11-009 | All authenticated | OBSERVED |
| FN-M01-3.2.5 | Status filters "Semua (N)" → `/notifikasi`, "Belum Dibaca (N)" → `?filter=unread`, "Sudah Dibaca" → `?filter=read` | S11-010–012 | All authenticated | OBSERVED |
| FN-M01-3.2.6 | Divider "\|" + category filters "Sistem" (`fa-cog`) → `?type=system`, "Peringatan" (`fa-clock`) → `?type=reminder`, "Pencapaian" (`fa-trophy`) → `?type=milestone` | S11-013–016 | All authenticated | OBSERVED; the active category pill is highlighted (DV-12; live highlights none) |
| FN-M01-3.2.7 | Notification item card: bell icon circle, title, body, meta "🕒 {relative time}" + uppercase type-code badge; unread styling (indigo tint, bold title, dot) | S11-023, 026, 028, 031 | All authenticated | OBSERVED |
| FN-M01-3.2.8 | Clicking an item body (outside select mode) marks it read (`POST /notifikasi/{id}/read`) and restyles it as read | S11-025, 030 | All authenticated | OBSERVED (code) / INFERRED (result) |
| FN-M01-3.2.9 | Item delete button (`fa-trash-alt`, tooltip `title="Padam"`): on hover-capable devices it has opacity 0 and appears while the pointer is over it (as live); on touch devices and on keyboard focus it is always visible (DV-11). Native confirm "Padam notifikasi ini?" → `DELETE /notifikasi/{id}` → item hidden → page reload. Hidden in select mode | S11-027, 032 | All authenticated | OBSERVED (code) + DV-11 |
| FN-M01-3.2.10 | Pagination ≥640px: English summary "Showing {from} to {to} of {total} results", numbered page links, chevron prev/next (aria "&laquo; Previous" / "Next &raquo;"), links keep the active filter | S11-035–048, 050–058, 061–063, 066 | All authenticated | OBSERVED |
| FN-M01-3.2.11 | Pagination <640px: "« Previous" / "Next »" (plain text when unavailable) | S11-033–034, 049, 059–060, 064–065 | All authenticated | OBSERVED |
| FN-M01-3.2.12 | Empty state: slashed bell, "Tiada notifikasi" / "Notifikasi baru akan muncul di sini" | S11-067–068 | All authenticated | OBSERVED |

**FT-M01-3.3 — Select mode and bulk actions** (S11)

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M01-3.3.1 | "Pilih Semua" checkbox: ticks or unticks every item on the current page | S11-017–018 | All authenticated | OBSERVED |
| FN-M01-3.3.2 | Per-item checkbox (select mode only) | S11-024, 029 | All authenticated | OBSERVED |
| FN-M01-3.3.3 | Counter "{n} dipilih" (shown when n ≥ 1) | S11-019 | All authenticated | OBSERVED |
| FN-M01-3.3.4 | "Tanda Dibaca" (`fa-check`, n ≥ 1) → `POST /notifikasi/bulk-read {ids}` | S11-020 | All authenticated | OBSERVED (code) / INFERRED (result) |
| FN-M01-3.3.5 | "Padam" (`fa-trash`, n ≥ 1) → native confirm "Padam {n} notifikasi yang dipilih?" → `POST /notifikasi/bulk-delete {ids}` | S11-021 | All authenticated | OBSERVED (code) / INFERRED (result) |
| FN-M01-3.3.6 | "Batal" leaves select mode and clears the selection | S11-022 | All authenticated | OBSERVED |

**Totals:** 3 epics · 16 features · 111 functions.

---

## 4. User stories

| ID | Feature | Priority | Story | Functions |
|---|---|---|---|---|
| US-M01-01 | FT-M01-1.2 | Must | As a registered user, I want to log in with my email and password, so that I can reach my area of the platform. | FN-M01-1.2.15, 1.2.2, 1.2.3, 1.2.8, 1.2.9, 1.2.10, 1.2.11 |
| US-M01-02 | FT-M01-1.2 | Must | As a visitor on the login page, I want to see what the platform offers and reach the other auth pages, so that I can find the right action. | FN-M01-1.1.1, 1.1.2, 1.1.3, 1.2.1, 1.2.6, 1.2.7, 1.2.12, 1.2.13, 1.2.14 |
| US-M01-03 | FT-M01-1.2 | Should | As a user logging in, I want to reveal my password and choose "Ingat saya", so that I can avoid typos and stay logged in on my own device. | FN-M01-1.2.4, 1.2.5, 1.3.2 |
| US-M01-04 | FT-M01-1.3 | Must | As a user who has just logged in, I want to land on my role's page, so that I can start working. | FN-M01-1.3.1, 1.3.4 |
| US-M01-05 | FT-M01-1.3 | Must | As the platform owner, I want account pages to require login, so that personal data stays private. | FN-M01-1.3.3 |
| US-M01-06 | FT-M01-1.4 | Must | As a new user, I want a registration page with my name, email and phone, so that I can create an account. | FN-M01-1.1.1, 1.1.2, 1.1.3, 1.4.1, 1.4.2, 1.4.3, 1.4.4, 1.4.5, 1.4.13, 1.4.14, 1.4.15, 1.4.16 |
| US-M01-07 | FT-M01-1.4 | Must | As a new user, I want to say whether I am a Pelajar, Guru or Ibu Bapa, and as a Pelajar give my level and optionally my IC, so that the platform fits me. | FN-M01-1.4.6, 1.4.7, 1.4.8 |
| US-M01-08 | FT-M01-1.4 | Should | As a new user, I want to find and pick my school, so that I am linked to my school. | FN-M01-1.4.9 |
| US-M01-09 | FT-M01-1.4 | Must | As a new user, I want to set a password and submit the form, so that my account is created and I am logged in. | FN-M01-1.4.10, 1.4.11, 1.4.12, 1.4.17, 1.4.18 |
| US-M01-10 | FT-M01-1.5 | Must | As a user who forgot my password, I want to request a reset link by email, so that I can regain access. | FN-M01-1.5.1–1.5.5 |
| US-M01-11 | FT-M01-1.6 | Must | As a user with a reset link, I want to set a new password, so that I can log in again. | FN-M01-1.6.1–1.6.8 |
| US-M01-12 | FT-M01-1.7 | Should | As a student with a stored IC, I want to reset my password with my email and IC number, so that I can regain access without the email link. | FN-M01-1.7.1–1.7.6 |
| US-M01-13 | FT-M01-1.8 | Must | As a logged-in user, I want to log out from any page, so that the next person on the device cannot use my account. | FN-M01-1.8.1, 1.8.2 |
| US-M01-14 | FT-M01-2.1 | Must | As a logged-in user, I want to see my profile, so that I can check my account details. | FN-M01-2.1.1, 2.1.2, 2.1.3 |
| US-M01-15 | FT-M01-2.2 | Should | As a logged-in user, I want to upload a profile picture, so that my account looks like me. | FN-M01-2.2.2, 2.2.3 |
| US-M01-16 | FT-M01-2.2 | Must | As a logged-in user, I want to edit my name, phone, bio and level, so that my details stay correct. | FN-M01-2.2.1, 2.2.4, 2.2.5, 2.2.6, 2.2.7, 2.2.8, 2.2.11, 2.2.12 |
| US-M01-17 | FT-M01-2.2 | Should | As a logged-in user, I want to set or change my school, so that I can connect with my classmates. | FN-M01-2.2.9, 2.2.10 |
| US-M01-18 | FT-M01-2.2 | Must | As a logged-in user, I want to change my password, so that I can keep my account secure. | FN-M01-2.2.13, 2.2.14 |
| US-M01-19 | FT-M01-2.3 | Should | As a logged-in user, I want to set my spiritual-mode and faith preferences, so that reminders and content suit me. | FN-M01-2.3.1–2.3.9 |
| US-M01-20 | FT-M01-2.5 | Must | As a logged-in user, I want to see who I am logged in as and reach my profile and settings from the menus, so that my account is always one tap away. | FN-M01-2.5.1, 2.5.2 |
| US-M01-21 | FT-M01-2.4 | Must | As a mobile user, I want the drawer's "Tetapan" link to open my settings, and a helpful page when an address does not exist, so that I never get stuck. | FN-M01-2.4.1, 2.4.2, 2.4.3 |
| US-M01-22 | FT-M01-3.1 | Must | As a logged-in user, I want a bell with my unread count in the header that stays current, so that I notice new notifications. | FN-M01-3.1.1 |
| US-M01-23 | FT-M01-3.2 | Must | As a logged-in user, I want to browse and filter my notifications page by page, so that I can find what matters. | FN-M01-3.2.1, 3.2.2, 3.2.5, 3.2.6, 3.2.7, 3.2.10, 3.2.11, 3.2.12 |
| US-M01-24 | FT-M01-3.2 | Must | As a logged-in user, I want to mark notifications read (one or all) and delete one, so that my inbox reflects what I have seen. | FN-M01-3.2.3, 3.2.8, 3.2.9 |
| US-M01-25 | FT-M01-3.3 | Should | As a logged-in user, I want to select several notifications and mark them read or delete them together, so that I can clean up quickly. | FN-M01-3.2.4, 3.3.1–3.3.6 |
| US-M01-26 | cross-cutting (all M01 features) | Must | As a user on a phone, tablet or desktop, I want every M01 screen to fit my screen and work with touch, so that I can use my account on any device. | All screen FNs; DV-07, DV-08, DV-10, DV-11 |

### Acceptance criteria

**US-M01-01 — Log in**
- **AC-M01-01.1** Given I am on `/login`, when the page loads, then I see "Alamat Email" (placeholder `nama@email.com`), "Kata Laluan" (placeholder `••••••••`) and the button "Log Masuk" with a sign-in icon.
- **AC-M01-01.2** Given a field is empty or the email has no valid format, when I press "Log Masuk", then the browser's native validation message appears on that field and no login request is sent.
- **AC-M01-01.3** Given valid credentials, when I press "Log Masuk", then the button is replaced by a disabled button with a spinner and "Sedang Memasuki...", and I am then redirected (US-M01-04) with no success or welcome message.
- **AC-M01-01.4** Given the email is unknown or the password is wrong, when I press "Log Masuk", then a red alert "Email atau kata laluan tidak sah." appears above the fields, the email stays filled and the password is empty.
- **AC-M01-01.5** (INFERRED) Given 5 failed attempts for the same email within 1 minute, when I try again, then the same red alert area shows the throttle message (UNVERIFIED COPY, SRS §8) and I am not logged in.
- **AC-M01-01.6** (INFERRED) Given my account is inactive (an admin switched it off in M02), when I enter my correct email and password and press "Log Masuk", then I am not logged in, and the red alert shows "Akaun anda tidak aktif. Sila hubungi pentadbir." (UNVERIFIED COPY, same placeholder as M02).
- **AC-M01-01.7** (INFERRED; M14) Given I log in successfully with the form, when the login completes, then the gamification login hook runs once for me (M14 BR-M14-14: streak update and, for a student's first password login of the day, the +2 `daily_login` coins), so my header chips show the updated values.

**US-M01-02 — Login page content and links**
- **AC-M01-02.1** Given `/login` at any width, when it loads, then I see the floating emoji 📚 ✏️ ⭐ 🎨 🚀 💡, the logo, "Platform Latih Tubi Nasional 🇲🇾" and the footer "© 2026 PRESTASIPLUS. Platform Pendidikan Malaysia."
- **AC-M01-02.2** Given the two-column width (≥1024px, DV-07), when the page loads, then the welcome panel shows 🎓, "Selamat Kembali! 👋", "Teruskan pembelajaran anda dengan lebih {soalan} soalan latihan dalam {subjek} subjek berbeza!" and the tiles "🏆 Pencapaian Terbuka / Kumpul lencana dan skor tertinggi", "📈 Jejak Kemajuan / Lihat statistik pembelajaran anda" and "🎯 Latihan Tersusun / Dari mudah hingga mencabar". Below that width, the panel is hidden.
- **AC-M01-02.3** Given the stats strip, when it loads, then it reads "❓ {soalan}+ Soalan • 📚 {subjek} Subjek • 🎓 {tahap} Tahap", with numbers formatted like "128,989". The numbers come from the same single source as the welcome text (DV-05): questions = the M04 named query Q-ELIGIBLE (approved and active questions), subjects and levels from M03.
- **AC-M01-02.4** Given the links, when I use them, then "Lupa kata laluan?" opens `/password/reset`, "Reset melalui No IC" (ID-card icon) opens `/password/reset-ic`, "Daftar Sekarang 🚀" (after "Belum ada akaun?") opens `/register`, and "Kembali ke Laman Utama" (arrow-left icon) opens `/`.

**US-M01-03 — Show password and remember me**
- **AC-M01-03.1** Given I typed a password, when I press the eye button, then the password is shown as text and the icon changes from eye to eye-slash. Pressing it again hides the password and restores the eye icon.
- **AC-M01-03.2** Given "Ingat saya" is unticked by default, when I log in without ticking it, then my session expires 120 minutes after my last request (OBSERVED cookie lifetime) and survives a browser restart within that time. When I log in with it ticked, I stay logged in across browser restarts until I log out (INFERRED long-lived remember cookie).

**US-M01-04 — Redirect after login**
- **AC-M01-04.1** Given I am an admin, when login succeeds, then I land on `/admin` with no flash message.
- **AC-M01-04.2** Given I was sent to `/login` while opening a protected page (for example `/notifikasi` or `/tetapan`), when login succeeds, then I still land on my role's landing page, not on the page I wanted.
- **AC-M01-04.3** (INFERRED) Given I am another role, when login succeeds, then I land on the landing page for my role (SRS BR-07).
- **AC-M01-04.4** Given I am logged in, when I open `/login` or `/register`, then the page renders exactly as for a guest, with no redirect and no notice.

**US-M01-05 — Pages that need an account**
- **AC-M01-05.1** Given I am a guest, when I open `/profile`, `/profile/edit`, `/tetapan`, `/notifikasi`, `/dashboard` or `/admin`, then I am redirected to `/login` with no message.
- **AC-M01-05.2** Given I am a guest, when the app requests account data (for example the unread count), then no data is returned and I end up on `/login`.

**US-M01-06 — Registration page and basic fields**
- **AC-M01-06.1** Given `/register`, when it loads, then at every width I see the floating emoji 📚 ✏️ ⭐ 🎨 🚀 💡, the logo, "Daftar Akaun Baru 🇲🇾", and the step indicator "1 — 2 — 3" with step 1 highlighted (static, not clickable). At ≥1024px (DV-07) I also see the welcome panel: the mascot bubble 🎒, "Sertai Kami! 🌟", "Daftar sekarang dan mulakan perjalanan pembelajaran yang menyeronokkan!", and the tiles "🎮 Pembelajaran Gamifikasi / Belajar sambil bermain", "👥 Komuniti Aktif / Belajar bersama rakan" and "📊 Laporan Terperinci / Pantau prestasi anda". Below that width the whole panel, including 🎒, is hidden.
- **AC-M01-06.2** Given the form, when it loads, then I see "Nama Penuh" (placeholder `Muhammad Fulan bin Fulan`, required), "Alamat Email" (placeholder `nama@email.com`, required) and "No. Telefon (Pilihan)" (placeholder `Cth: 0191234567`, at most 14 characters).
- **AC-M01-06.3** Given the links, when I use them, then "Log Masuk 🔑" (after "Sudah ada akaun?") opens `/login`, "Daftar sebagai Penaja" (after "Mewakili organisasi?", handshake icon) opens `/sponsor/register`, and "Kembali ke Laman Utama" (home icon) opens `/`. The footer is shown.
- **AC-M01-06.4** Given I open `/register?role=teacher`, `/register?role=parent` or `/register?ref=ABC`, when the page loads, then "Pelajar" is still selected and no extra field appears.
- **AC-M01-06.5** (provisional, INFERRED; M14) Given I opened `/register?ref=ABC1234`, when I register successfully, then the code is sent with my registration and M14 applies its referral rule (BR-M14-19). The form itself is unchanged (no field, no hidden input).

**US-M01-07 — Role, level and IC**
- **AC-M01-07.1** Given "Saya adalah...", when the page loads, then I see the cards "👨‍🎓 Pelajar / Saya ingin belajar" (selected), "👨‍🏫 Guru / Saya ingin mengajar" and "👨‍👩‍👧 Ibu Bapa / Pantau anak saya". Clicking a card highlights it and sets the role.
- **AC-M01-07.2** Given "Pelajar" is selected, when I view the form, then I see "Pilih Tahap Anda" with the sub-headings displayed "SEKOLAH RENDAH" (Darjah 1–6) and "SEKOLAH MENENGAH" (Ting. 1–5), uppercased by CSS, and nothing selected. Clicking a level highlights it; Darjah n submits n and Ting. n submits n + 6.
- **AC-M01-07.3** Given "Pelajar" is selected, when I view the form, then I see "No. Kad Pengenalan (Pilihan)" (placeholder `Cth: 031215101234`, numeric keypad, at most 14 characters, DV-04) and the shield hint "Dilindungi PDPA. Hanya 2 digit terakhir akan dipaparkan."
- **AC-M01-07.4** Given I select "Guru" or "Ibu Bapa", when the selection changes, then the level picker and the IC field are hidden (for Ibu Bapa this applies DV-06).

**US-M01-08 — School at registration**
- **AC-M01-08.1** Given "Sekolah (Pilihan)", when no school is chosen, then I see a state select (first option "Negeri", then Johor, Kedah, Kelantan, KL, Labuan, Melaka, N.Sembilan, Pahang, Perak, Perlis, P.Pinang, Putrajaya, Sabah, Sarawak, Selangor, Terengganu) and the search box "Taip nama sekolah...".
- **AC-M01-08.2** Given I focus the search box, when I type at least 2 characters (after a 300 ms pause) or choose a state, then a dropdown lists up to 15 schools. Each shows the NAME in bold and "{jenis} · {negeri} · {daerah}", where the third part is the school's district as stored (for example "PPD SEGAMAT" or "JPN PERLIS"). Clicking outside closes it.
- **AC-M01-08.3** Given I typed at least 2 characters and nothing matches, when the search finishes, then the dropdown shows "Tiada sekolah dijumpai" with a search icon.
- **AC-M01-08.4** Given I click a school, when it is chosen, then the select and search are replaced by the school name with "{jenis} · {negeri}" and a ✕ button, and the school is submitted with the form. Pressing ✕ clears it and brings back the select and search.

**US-M01-09 — Password and submit**
- **AC-M01-09.1** Given the password section, when it loads, then I see "Kata Laluan" (placeholder `••••••••`, eye toggle, info hint "Minimum 6 aksara") and "Sahkan Kata Laluan" (placeholder `••••••••`, its own eye toggle).
- **AC-M01-09.2** Given the form is valid for the browser, when I press "Daftar Sekarang" (user-plus icon), then the button becomes disabled with a spinner and "Sedang Mendaftar...".
- **AC-M01-09.3** Given a required field (name, email, password, confirmation) is empty or the email is malformed, when I submit, then the browser's native validation message appears and nothing is sent.
- **AC-M01-09.4** (INFERRED) Given the server accepts the data, when registration completes, then my account exists with the chosen role (and level, IC and school if given), I am logged in, and I land on my role's landing page with no email verification step.
- **AC-M01-09.5** (INFERRED) Given the server rejects the data (email already registered, password shorter than 6, confirmation mismatch, Pelajar without level), when the page returns, then `/register` shows the error(s) (UNVERIFIED COPY, SRS §8) and my earlier input except the passwords.

**US-M01-10 — Forgot password**
- **AC-M01-10.1** Given `/password/reset`, when it loads, then I see 🔑, "Lupa Kata Laluan?", "Masukkan email anda dan kami akan hantar pautan untuk reset kata laluan.", "Alamat Email" (focused, placeholder `nama@email.com`), "Hantar Pautan Reset" (paper-plane icon), "Kembali ke Log Masuk" (arrow-left) and the footer. There is no link to the IC reset.
- **AC-M01-10.2** Given a valid email, when I press "Hantar Pautan Reset", then the button becomes disabled with a spinner and "Menghantar...".
- **AC-M01-10.3** (INFERRED) Given the email is registered, when the request completes, then the page shows the "link sent" status. Given the email is unknown or I retry too soon, the page shows the matching error (UNVERIFIED COPY, SRS §8).
- **AC-M01-10.4** Given the email is empty or malformed, when I submit, then the browser's native validation message appears.

**US-M01-11 — Set a new password by link**
- **AC-M01-11.1** Given `/password/reset/{token}?email=x`, when it loads, then I see 🔒, "Reset Kata Laluan", "Masukkan kata laluan baru anda.", "Alamat Email" pre-filled with x, "Kata Laluan Baru" (placeholder "Minimum 6 aksara", eye toggle), "Sahkan Kata Laluan" (placeholder "Taip semula kata laluan", eye toggle), "Tukar Kata Laluan" (check-circle icon) and "Kembali ke Log Masuk". Without `?email=` the email field is empty, editable and required.
- **AC-M01-11.2** Given any token value, when I open the URL, then the form renders (the token is not checked until submit).
- **AC-M01-11.3** Given the form is valid for the browser, when I submit, then the button becomes disabled with a spinner and "Menukar...".
- **AC-M01-11.4** (INFERRED) Given a valid, unexpired token and matching passwords of at least 6 characters, when the request completes, then my password is changed, I am logged in and redirected to my landing page with a status message. Given an invalid or expired token, the form shows an error (UNVERIFIED COPY, SRS §8).

**US-M01-12 — Reset by email + IC**
- **AC-M01-12.1** Given `/password/reset-ic`, when it loads, then I see the ID-card icon, "Reset Melalui No IC", "Masukkan email dan No Kad Pengenalan yang didaftarkan dalam profil anda.", "Alamat Email" (focused), "No Kad Pengenalan" (placeholder `000101010000`, at most 14 characters per DV-04), the hint "Tanpa tanda sempang (-). Contoh: 000101010000", "Reset Kata Laluan" (unlock icon) and "Kembali ke Log Masuk".
- **AC-M01-12.2** Given both fields are filled, when I submit, then the button becomes disabled with a spinner and "Memproses...".
- **AC-M01-12.3** (INFERRED) Given the email and IC match an account, when the request completes, then I am taken to the set-new-password form (`/password/reset/{token}?email=…`). Given they do not match, the page shows an error (UNVERIFIED COPY, SRS §8).

**US-M01-13 — Log out**
- **AC-M01-13.1** Given I am logged in, when I look for logout, then it is available: in the user shell at ≥1024px as the icon in the sidebar user block and the header icon (tooltip "Log Keluar"), and below 1024px as "Log Keluar" in the drawer; in the admin shell at ≥1024px as the sidebar footer icon and the header icon, and below 1024px as "Log Keluar" in the "Lagi" menu.
- **AC-M01-13.2** Given I activate logout, when it completes, then I am on `/login` with no message and there was no confirmation step.
- **AC-M01-13.3** Given I have logged out, when I open a protected page or press Back, then I end up on `/login`.

**US-M01-14 — View profile**
- **AC-M01-14.1** Given `/profile`, when it loads, then the shell header shows "Profil Saya" / "Statistik & Pencapaian Anda".
- **AC-M01-14.2** Given the hero card, when it loads, then I see my generated initials avatar with the orange crown badge, my name, my email and "Ahli sejak {d MMMM yyyy}" in white (DV-14), the last with a calendar icon and a BM month (for example "Ahli sejak 6 Februari 2026"), and "Kemaskini Profil" (pen icon), which opens `/profile/edit`.
- **AC-M01-14.3** Given I am an admin, when the page loads, then no statistics or achievements block is shown (as on the live site). For other roles see OQ-4.

**US-M01-15 — Profile picture**
- **AC-M01-15.1** Given the "Gambar Profil" card, when it loads, then I see a 96px avatar, "Pilih Gambar" and "JPG, PNG atau WEBP. Maks 2MB.". Hovering the avatar shows a dark overlay with a camera icon, and clicking the avatar or "Pilih Gambar" opens a file chooser limited to JPEG/PNG/WEBP.
- **AC-M01-15.2** Given I choose an image, when it is read, then the avatar preview shows the chosen image and a "Simpan" button (check icon) appears. Nothing is uploaded yet.
- **AC-M01-15.3** (INFERRED) Given I press "Simpan", when the upload completes, then the page reloads and shows my new picture. If the file is rejected (not an image, or over 2MB), an error is shown (UNVERIFIED COPY).

**US-M01-16 — Edit details**
- **AC-M01-16.1** Given `/profile/edit`, when it loads, then the header shows "Kemaskini Profil" / "Maklumat peribadi & sekolah anda", and the card "Maklumat Peribadi" shows "Nama Penuh" (pre-filled, required), "Email" (disabled, grey) with "Email tidak boleh diubah", "No. Telefon" (placeholder `012-3456789`) and "Bio / Motto" (placeholder "Tulis sesuatu tentang diri anda...", at most 500 characters). The counter reads "Baki: 500 aksara" and stays exactly that when I type or when the bio already has content (static, as live).
- **AC-M01-16.2** Given the "Tahap" section, when it loads, then I see the sub-heading displayed "SEKOLAH RENDAH" with the cards Darjah 1–6 and my current level highlighted. Choosing another card highlights it. (INFERRED: a user whose level is in Tingkatan sees "SEKOLAH MENENGAH" with Ting. 1–5 instead; OQ-5.)
- **AC-M01-16.3** Given the actions row, when I use it, then "Kembali" opens `/profile` and "Simpan Profil" submits my name, phone, bio, level and school.
- **AC-M01-16.4** (INFERRED) Given I save, when the request completes, then the page returns with my saved values and a success message, or with an error if "Nama Penuh" is empty (UNVERIFIED COPY).

**US-M01-17 — School on the profile**
- **AC-M01-17.1** Given the "Maklumat Sekolah" card, when I have a school, then I see "Pilih sekolah anda untuk sambung dengan rakan sekelas" and a green chip with the SCHOOL NAME and "{jenis} · {negeri} · {PPD}" (each "·" shown only when the next value exists), plus a clear button (✕ in a circle).
- **AC-M01-17.2** Given I clear the school, when the picker appears, then I see a state select ("Semua Negeri", then the 16 states with full names) and the search "Taip nama sekolah (min. 2 huruf)...". Focusing opens the dropdown. Typing at least 2 characters (300 ms pause) or choosing a state lists up to 20 schools, each with a school icon. No "searching" indicator is shown.
- **AC-M01-17.3** Given at least 2 characters and no match, when the search finishes, then I see "Tiada sekolah dijumpai" / "Cuba tukar negeri atau kata kunci lain".
- **AC-M01-17.4** Given the search request fails, when it fails, then no message is shown and the list stays as it was.
- **AC-M01-17.5** Given I click a school, when it is chosen, then the chip replaces the picker, and the school is saved with "Simpan Profil".

**US-M01-18 — Change password**
- **AC-M01-18.1** Given the "Tukar Kata Laluan" card, when it loads, then I see "Kata Laluan Semasa", "Kata Laluan Baharu" with the hint "Sekurang-kurangnya 6 aksara" (DV-03) and "Sahkan Kata Laluan Baharu". The fields have no eye toggles and no browser-required check. The button reads "Tukar Kata Laluan" with a shield icon.
- **AC-M01-18.2** (INFERRED) Given I submit, when the request completes, then with a correct current password and a valid, confirmed new password I see a success message and the new password works at the next login. Otherwise the matching error is shown (UNVERIFIED COPY).

**US-M01-19 — Personal settings**
- **AC-M01-19.1** Given `/tetapan`, when it loads, then I see the hero "⚙️ Tetapan Peribadi" / "Atur pengalaman PrestasiPlus mengikut keperluan rohani & masa anda." and:
  - the card "🕌 Mod Rohani" with "Personalisasi pembelajaran ikut nilai keagamaan anda. Boleh toggle off bila-bila masa.", containing:
    - "Aktifkan Mod Rohani" — "Master toggle — kalau off, semua spiritual touchpoints disable.";
    - "Tunjuk doa sebelum quiz" — "Splash 2-saat sebelum mula quiz: "Bismillahi tawakkaltu 'alallah". Tetapan untuk Muslim.";
    - "Push waktu Subuh" — "Push notifikasi pagi awal untuk yang bangun Subuh — 30 minit study window selepas Subuh = paling produktif." — with a time field;
    - "Mod Ramadan" — "Push waktu sahur (~4:30am) untuk study sebelum Subuh. Pace lebih ringan waktu Ramadan." — with a time field;
  - the card "🌍 Latar Agama (opsyen)" with "Bagi konteks supaya AI dan content lebih relevan. Tidak diwajibkan." and "Agama / kepercayaan" — "Untuk mod rohani yang sesuai. Future: Hindu/Buddhist/Christian content akan ditambah." — with the options "— Tidak nyatakan —", "Islam", "Hindu", "Buddha", "Kristian", "Tiada";
  - the button "💾 Simpan Tetapan".
- **AC-M01-19.2** Given I have never saved settings, when the page loads, then all 4 checkboxes are unticked, the Subuh time is 05:30, the sahur time is 04:30, and faith is "— Tidak nyatakan —".
- **AC-M01-19.3** Given any combination of checkboxes, when I tick or untick them, then no other control is shown, hidden, enabled or disabled; both time fields are always editable.
- **AC-M01-19.4** Given I am an admin, when `/tetapan` loads, then it renders inside the admin shell and the shell header reads "Tetapan Peribadi" (DV-13).
- **AC-M01-19.5** (INFERRED) Given I press "Simpan Tetapan", when the request completes, then the page returns with my saved values and a success message (UNVERIFIED COPY).

**US-M01-20 — Account entries and identity in the shells**
- **AC-M01-20.1** Given the user shell, when I open the menu, then at ≥1024px the sidebar has "Tetapan Peribadi" (→ `/tetapan`) and "Profil Saya" (→ `/profile`), and below 1024px the drawer has "Tetapan Peribadi" (→ `/tetapan`) and "Profil Saya" (→ `/profile`).
- **AC-M01-20.2** Given the admin shell at ≥1024px, when I view the sidebar, then it has "Tetapan Peribadi" (→ `/tetapan`).
- **AC-M01-20.3** Given I am logged in, when I view the shells, then my identity shows as live:
  - user sidebar card: avatar, name and email;
  - user header avatar at ≥1024px;
  - drawer user card: avatar, name and the lowercase role code (for example "admin");
  - admin sidebar card: avatar, name and "Admin";
  - admin header avatar.

**US-M01-21 — `/settings` link and the 404 page**
- **AC-M01-21.1** Given the user-shell drawer (<1024px), when I tap "Tetapan" (cog icon), then `/tetapan` opens (DV-01).
- **AC-M01-21.2** Given I open `/settings` (or any unknown path) directly, when the page loads, then I see the standalone 404 page: "404", 🔍, "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama" (→ `/`), "Mula Latihan" (→ `/practice`, DV-02) and "PRESTASIPLUS", with the tab title "404 - Halaman Tidak Dijumpai | PRESTASIPLUS".

**US-M01-22 — Header bell**
- **AC-M01-22.1** Given the user shell at any width, when it loads, then the header shows a bell (tooltip "Notifikasi") linking to `/notifikasi`, with a red badge showing my unread count, or "99+" when above 99.
- **AC-M01-22.2** (OBSERVED, page script) Given I have no unread notifications, when the badge is refreshed, then no badge is shown.
- **AC-M01-22.3** Given I stay on any user-shell page, when 60 seconds pass, or a foreground push message arrives, then the badge is refreshed from the unread count without a page reload (for example it appears, changes, or disappears when the count reaches 0).

**US-M01-23 — Browse and filter the inbox**
- **AC-M01-23.1** Given `/notifikasi`, when it loads, then the header shows "Notifikasi" / "Peti masuk mesej anda", and the title row shows "Peti Masuk" with a red pill containing my unread count.
- **AC-M01-23.2** Given the filters, when I use them, then:
  - "Semua ({total})" opens `/notifikasi`;
  - "Belum Dibaca ({unread})" opens `?filter=unread`;
  - "Sudah Dibaca" (no count) opens `?filter=read`;
  - after the "|" divider, "Sistem" (cog), "Peringatan" (clock) and "Pencapaian" (trophy) open `?type=system|reminder|milestone`.

  Each shows only the matching items. The active status pill is highlighted, and when a category filter is active, that category pill is highlighted (DV-12).
- **AC-M01-23.3** Given I have notifications, when the list shows, then they are newest first, 20 per page. Each has a round bell icon, a title, a body, and a meta line with a clock and a BM relative time (for example "13 jam yang lepas") plus the type code in uppercase (for example "SPACED_REVIEW"). Unread items have an indigo tint, a bold indigo title and a dot.
- **AC-M01-23.4** Given more than 20 items, when I view the pagination, then at ≥640px I see "Showing {from} to {to} of {total} results", numbered page links and chevron previous/next links. Below 640px I see "« Previous" / "Next »", shown as plain text when not available. Every page link keeps the active filter (for example `?filter=unread&page=2`).
- **AC-M01-23.5** Given the list (or the filtered list) is empty, when it loads, then I see the slashed bell, "Tiada notifikasi" and "Notifikasi baru akan muncul di sini". "Pilih" is not shown, and "Tanda semua dibaca" is still shown.

**US-M01-24 — Mark read and delete one**
- **AC-M01-24.1** Given an unread item and select mode off, when I click it, then it is marked read and restyled as read (tint, bold and dot removed). I stay on the page.
- **AC-M01-24.2** (INFERRED) Given I press "Tanda semua dibaca" (double-check icon), when the request completes, then the page reloads with every notification read and the unread counts at 0.
- **AC-M01-24.3** Given an item's delete button (bin icon, tooltip "Padam"), which appears on hover on hover-capable devices and is always visible on touch screens and on keyboard focus (DV-11), when I press it, then the browser confirm "Padam notifikasi ini?" appears. OK hides the item and reloads the page without it; Cancel changes nothing.

**US-M01-25 — Select mode and bulk actions**
- **AC-M01-25.1** Given I press "Pilih", when select mode starts, then "Tanda semua dibaca", "Pilih" and each item's delete button are hidden; "Pilih Semua" (checkbox) and "Batal" appear; each item gets a checkbox; and clicking an item body no longer marks it read.
- **AC-M01-25.2** Given I tick at least 1 item, when the selection changes, then I see "{n} dipilih", "Tanda Dibaca" (check icon) and "Padam" (bin icon).
- **AC-M01-25.3** Given I tick "Pilih Semua", when it applies, then every item on the current page only is ticked (for example "20 dipilih"). Unticking it clears them.
- **AC-M01-25.4** (INFERRED) Given I press "Tanda Dibaca", when the request completes, then the page reloads with the selected items read.
- **AC-M01-25.5** Given I press "Padam", when the browser confirm "Padam {n} notifikasi yang dipilih?" is accepted, then the selected items are deleted and the page reloads (INFERRED). Cancel changes nothing.
- **AC-M01-25.6** Given select mode, when I press "Batal", then select mode ends, the selection is cleared and the normal controls return.

**US-M01-26 — Every device**
- **AC-M01-26.1** Given any M01 screen at 375, 768 or 1280px, when it renders, then there is no horizontal page scroll and the layout matches SRS §10.
- **AC-M01-26.2** Given `/login` or `/register` below 1024px, when it renders, then there is one centred column with no clipped labels, options or placeholders, and stats-strip items are not split across lines (DV-07).
- **AC-M01-26.3** Given `/tetapan` below 640px, when it renders, then each control sits under its label and the faith select fits the screen (DV-08).
- **AC-M01-26.4** *(Withdrawn in v1.1 — AUD-M01-02: DV-09 was not reproduced. `/profile/edit` keeps the live inline actions row, "Kembali" left and "Simpan Profil" right, at every width. The ID is kept for traceability.)*
- **AC-M01-26.5** Given `/notifikasi` at any width, when it renders, then no native scrollbar shows under the filter pills and every pill can be reached (DV-10).
- **AC-M01-26.6** Given `/register` and `/profile/edit`, when I choose a role card or a level card by clicking or tapping, then it is selected. The cards are click/tap targets without keyboard semantics, as live (DV-15 rejected).
- **AC-M01-26.7** Given any M01 screen at any width, when it renders, then no content text is smaller than 12px (DV-16).

**Count:** 26 user stories · 101 active acceptance criteria (102 IDs; AC-M01-26.4 withdrawn in v1.1; AC-M01-22.3 added in v1.1, AC-M01-01.6 in v1.3, AC-M01-26.7 in v1.6, AC-M01-01.7 and AC-M01-06.5 in v1.10).

---

## 5. UI expectations

Behaviour and content match the live site, including its look (design tokens in `00-global-ui.md` §6). The visual reference is the screenshots.

| Screen | Key content and states | Screenshots |
|---|---|---|
| Auth layout (S1–S5) | Standalone page, no shell. Animated gradient; floating emoji on login/register; single centred card on the password pages; footer. | `login-*.png`, `password-reset-*.png` |
| `/login` | Welcome panel (≥1024px), form card, stats strip. States: idle, password visible, loading, invalid-credentials alert. | `login-desktop/tablet/mobile.png`, `login-error-desktop.png` |
| `/register` | Welcome panel (≥1024px), step indicator, role cards, level grid and IC (Pelajar), school picker (select + search → dropdown / empty / chip), passwords. States: idle, per role, school results / empty / selected, loading. | `register-*.png` |
| `/password/reset`, `/password/reset/{token}`, `/password/reset-ic` | Centred card. States: idle, loading. | `password-reset-*.png`, `password-reset-token-desktop.png`, `password-reset-ic-*.png` |
| `/profile` | User shell; hero card. | `profile-desktop.png` |
| `/profile/edit` | User shell; picture card (hover overlay, preview + Simpan); details card; Tahap; school card (chip / picker / dropdown / empty); actions; password card. | `profile-edit-*.png`, `profile-edit-school-search.png` |
| `/tetapan` | Admin shell for admin; hero; 2 cards; save. | `tetapan-desktop.png`, `tetapan-mobile.png` (overflow = DV-08) |
| `/settings` → 404 | Standalone 404 page. | `img/global/404-desktop.png` |
| `/notifikasi` | User shell; title row; filter strip; list; pagination (desktop/mobile variants); select mode; empty state. | `notifikasi-desktop.png`, `notifikasi-select-mode.png`, `notifikasi-empty-mobile.png` |

---

## 6. Coverage matrix (completeness proof)

Source: `docs/discovery/inventory/M01/` (generated 2026-09-25). Every M01 content element (S1–S11) is listed below with the Function that covers it, or a concrete exclusion reason. Shell elements (SHU/SHA) are layout chrome owned by the global shell / M23. Only the M01-relevant ones are mapped individually; the rest are listed by ID range with their owner. The "Content" column quotes the DOM source text. Where CSS changes how the text is displayed (for example `text-transform: uppercase`), the displayed form is given in brackets and specified in §3 and the SRS.

**Summary**

| Set | Elements | Mapped to an M01 Function | Excluded (with reason) | Unmapped |
|---|---|---|---|---|
| M01 content (S1–S5, S7–S11) | 363 | 354 | 9 (tournament banner, owned by M16: S7-001–003, S8-001–003, S11-001–003) | 0 |
| User shell SHU | 376 | 24 | 352 (global shell / M23 and other modules) | 0 |
| Admin shell SHA | 195 | 11 | 184 (global shell / M23 and other modules) | 0 |

**363/363 M01 content elements covered (354 by Functions, 9 by documented exclusion), 0 unmapped.** 96 of the 111 Functions in §3 appear in this matrix. The other 15 are behaviour-only Functions (1.2.9–1.2.11, 1.2.15, 1.3.1–1.3.4, 1.4.16–1.4.18, 1.5.5, 1.6.8, 1.7.6, 1.8.2) have no element by nature.

### 6.1 M01 content elements

#### S1 — `/login` (47 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M01-S1-001 | text | visible | "📚" | FN-M01-1.1.1 |
| EL-M01-S1-002 | text | visible | "✏️" | FN-M01-1.1.1 |
| EL-M01-S1-003 | text | visible | "⭐" | FN-M01-1.1.1 |
| EL-M01-S1-004 | text | visible | "🎨" | FN-M01-1.1.1 |
| EL-M01-S1-005 | text | visible | "🚀" | FN-M01-1.1.1 |
| EL-M01-S1-006 | text | visible | "💡" | FN-M01-1.1.1 |
| EL-M01-S1-007 | text | visible (desktop-only) | "🎓" | FN-M01-1.2.1 |
| EL-M01-S1-008 | card | visible (desktop-only) | "Selamat Kembali! 👋" | FN-M01-1.2.1 |
| EL-M01-S1-009 | heading | visible (desktop-only) | "Selamat Kembali! 👋" | FN-M01-1.2.1 |
| EL-M01-S1-010 | text | visible (desktop-only) | "Teruskan pembelajaran anda dengan lebih 128,989 soalan latihan dalam 3" | FN-M01-1.2.1 |
| EL-M01-S1-011 | text | visible (desktop-only) | "🏆" | FN-M01-1.2.1 |
| EL-M01-S1-012 | text | visible (desktop-only) | "Pencapaian Terbuka" | FN-M01-1.2.1 |
| EL-M01-S1-013 | text | visible (desktop-only) | "Kumpul lencana dan skor tertinggi" | FN-M01-1.2.1 |
| EL-M01-S1-014 | text | visible (desktop-only) | "📈" | FN-M01-1.2.1 |
| EL-M01-S1-015 | text | visible (desktop-only) | "Jejak Kemajuan" | FN-M01-1.2.1 |
| EL-M01-S1-016 | text | visible (desktop-only) | "Lihat statistik pembelajaran anda" | FN-M01-1.2.1 |
| EL-M01-S1-017 | text | visible (desktop-only) | "🎯" | FN-M01-1.2.1 |
| EL-M01-S1-018 | text | visible (desktop-only) | "Latihan Tersusun" | FN-M01-1.2.1 |
| EL-M01-S1-019 | text | visible (desktop-only) | "Dari mudah hingga mencabar" | FN-M01-1.2.1 |
| EL-M01-S1-020 | card | visible | "Alamat Email" | FN-M01-1.1.2 |
| EL-M01-S1-021 | image | visible | (img) | FN-M01-1.1.2 |
| EL-M01-S1-022 | text | visible | "Platform Latih Tubi Nasional 🇲🇾" | FN-M01-1.1.2 |
| EL-M01-S1-023 | form | visible | POST /login | FN-M01-1.2.8 |
| EL-M01-S1-024 | hidden-field | hidden | `_token` | FN-M01-1.2.8 |
| EL-M01-S1-025 | label | visible | "Alamat Email" | FN-M01-1.2.2 |
| EL-M01-S1-026 | input | visible | `email`, ph "nama@email.com" | FN-M01-1.2.2 |
| EL-M01-S1-027 | label | visible | "Kata Laluan" | FN-M01-1.2.3 |
| EL-M01-S1-028 | input | visible | `password`, ph "••••••••" | FN-M01-1.2.3 |
| EL-M01-S1-029 | toggle | visible | fa-eye | FN-M01-1.2.4 |
| EL-M01-S1-030 | checkbox | visible | `remember` | FN-M01-1.2.5 |
| EL-M01-S1-031 | label | visible | "Ingat saya" | FN-M01-1.2.5 |
| EL-M01-S1-032 | link | visible | "Lupa kata laluan?" → /password/reset | FN-M01-1.2.6 |
| EL-M01-S1-033 | link | visible | "Reset melalui No IC" → /password/reset-ic | FN-M01-1.2.7 |
| EL-M01-S1-034 | button | visible | "Log Masuk" | FN-M01-1.2.8 |
| EL-M01-S1-035 | text | hidden | "Log Masuk" | FN-M01-1.2.8 |
| EL-M01-S1-036 | text | hidden | "Sedang Memasuki..." | FN-M01-1.2.8 |
| EL-M01-S1-037 | text | visible | "Belum ada akaun?" | FN-M01-1.2.12 |
| EL-M01-S1-038 | link | visible | "Daftar Sekarang 🚀" → /register | FN-M01-1.2.12 |
| EL-M01-S1-039 | link | visible | "Kembali ke Laman Utama" → / | FN-M01-1.2.13 |
| EL-M01-S1-040 | text | visible | "❓" | FN-M01-1.2.14 |
| EL-M01-S1-041 | text | visible | "128,989+ Soalan" | FN-M01-1.2.14 |
| EL-M01-S1-042 | text | visible | "📚" | FN-M01-1.2.14 |
| EL-M01-S1-043 | text | visible | "31 Subjek" | FN-M01-1.2.14 |
| EL-M01-S1-044 | text | visible | "🎓" | FN-M01-1.2.14 |
| EL-M01-S1-045 | text | visible | "11 Tahap" | FN-M01-1.2.14 |
| EL-M01-S1-046 | text | visible | "© 2026 PRESTASIPLUS. Platform Pendidikan Malaysia." | FN-M01-1.1.3 |
| EL-M01-S1-047 | button | conditional (state captured @1280 only) | "Sedang Memasuki..." | FN-M01-1.2.8 |

#### S2 — `/register` (86 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M01-S2-001 | text | visible | "📚" | FN-M01-1.1.1 |
| EL-M01-S2-002 | text | visible | "✏️" | FN-M01-1.1.1 |
| EL-M01-S2-003 | text | visible | "⭐" | FN-M01-1.1.1 |
| EL-M01-S2-004 | text | visible | "🎨" | FN-M01-1.1.1 |
| EL-M01-S2-005 | text | visible | "🚀" | FN-M01-1.1.1 |
| EL-M01-S2-006 | text | visible | "💡" | FN-M01-1.1.1 |
| EL-M01-S2-007 | text | visible (desktop-only) | "🎒" (welcome-panel mascot) | FN-M01-1.4.1 |
| EL-M01-S2-008 | card | visible (desktop-only) | "Sertai Kami! 🌟" | FN-M01-1.4.1 |
| EL-M01-S2-009 | heading | visible (desktop-only) | "Sertai Kami! 🌟" | FN-M01-1.4.1 |
| EL-M01-S2-010 | text | visible (desktop-only) | "Daftar sekarang dan mulakan perjalanan pembelajaran yang menyeronokkan" | FN-M01-1.4.1 |
| EL-M01-S2-011 | text | visible (desktop-only) | "🎮" | FN-M01-1.4.1 |
| EL-M01-S2-012 | text | visible (desktop-only) | "Pembelajaran Gamifikasi" | FN-M01-1.4.1 |
| EL-M01-S2-013 | text | visible (desktop-only) | "Belajar sambil bermain" | FN-M01-1.4.1 |
| EL-M01-S2-014 | text | visible (desktop-only) | "👥" | FN-M01-1.4.1 |
| EL-M01-S2-015 | text | visible (desktop-only) | "Komuniti Aktif" | FN-M01-1.4.1 |
| EL-M01-S2-016 | text | visible (desktop-only) | "Belajar bersama rakan" | FN-M01-1.4.1 |
| EL-M01-S2-017 | text | visible (desktop-only) | "📊" | FN-M01-1.4.1 |
| EL-M01-S2-018 | text | visible (desktop-only) | "Laporan Terperinci" | FN-M01-1.4.1 |
| EL-M01-S2-019 | text | visible (desktop-only) | "Pantau prestasi anda" | FN-M01-1.4.1 |
| EL-M01-S2-020 | card | visible | "1" | FN-M01-1.1.2 |
| EL-M01-S2-021 | image | visible | (img) | FN-M01-1.1.2 |
| EL-M01-S2-022 | text | visible | "Daftar Akaun Baru 🇲🇾" | FN-M01-1.1.2 |
| EL-M01-S2-023 | badge | visible | "1" | FN-M01-1.4.2 |
| EL-M01-S2-024 | badge | visible | "2" | FN-M01-1.4.2 |
| EL-M01-S2-025 | badge | visible | "3" | FN-M01-1.4.2 |
| EL-M01-S2-026 | form | visible | POST /register | FN-M01-1.4.12 |
| EL-M01-S2-027 | hidden-field | hidden | `_token` | FN-M01-1.4.12 |
| EL-M01-S2-028 | label | visible | "Nama Penuh" | FN-M01-1.4.3 |
| EL-M01-S2-029 | input | visible | `name`, ph "Muhammad Fulan bin Fulan" | FN-M01-1.4.3 |
| EL-M01-S2-030 | label | visible | "Alamat Email" | FN-M01-1.4.4 |
| EL-M01-S2-031 | input | visible | `email`, ph "nama@email.com" | FN-M01-1.4.4 |
| EL-M01-S2-032 | label | visible | "No. Telefon (Pilihan)" | FN-M01-1.4.5 |
| EL-M01-S2-033 | input | visible | `phone`, ph "Cth: 0191234567" | FN-M01-1.4.5 |
| EL-M01-S2-034 | label | visible | "Saya adalah..." | FN-M01-1.4.6 |
| EL-M01-S2-035 | clickable | visible | "👨‍🎓 Pelajar Saya ingin belajar" | FN-M01-1.4.6 |
| EL-M01-S2-036 | clickable | visible | "👨‍🏫 Guru Saya ingin mengajar" | FN-M01-1.4.6 |
| EL-M01-S2-037 | clickable | visible | "👨‍👩‍👧 Ibu Bapa Pantau anak saya" | FN-M01-1.4.6 |
| EL-M01-S2-038 | hidden-field | hidden | `role` | FN-M01-1.4.6 |
| EL-M01-S2-039 | label | visible | "Pilih Tahap Anda" | FN-M01-1.4.7 |
| EL-M01-S2-040 | text | visible | "Sekolah Rendah" (displayed "SEKOLAH RENDAH" via CSS) | FN-M01-1.4.7 |
| EL-M01-S2-041 | clickable | hidden | "Darjah" | FN-M01-1.4.7 |
| EL-M01-S2-042 | clickable | visible | "Darjah 1" | FN-M01-1.4.7 |
| EL-M01-S2-043 | clickable | visible | "Darjah 2" | FN-M01-1.4.7 |
| EL-M01-S2-044 | clickable | visible | "Darjah 3" | FN-M01-1.4.7 |
| EL-M01-S2-045 | clickable | visible | "Darjah 4" | FN-M01-1.4.7 |
| EL-M01-S2-046 | clickable | visible | "Darjah 5" | FN-M01-1.4.7 |
| EL-M01-S2-047 | clickable | visible | "Darjah 6" | FN-M01-1.4.7 |
| EL-M01-S2-048 | text | visible | "Sekolah Menengah" (displayed "SEKOLAH MENENGAH" via CSS) | FN-M01-1.4.7 |
| EL-M01-S2-049 | clickable | hidden | "Ting." | FN-M01-1.4.7 |
| EL-M01-S2-050 | clickable | visible | "Ting. 1" | FN-M01-1.4.7 |
| EL-M01-S2-051 | clickable | visible | "Ting. 2" | FN-M01-1.4.7 |
| EL-M01-S2-052 | clickable | visible | "Ting. 3" | FN-M01-1.4.7 |
| EL-M01-S2-053 | clickable | visible | "Ting. 4" | FN-M01-1.4.7 |
| EL-M01-S2-054 | clickable | visible | "Ting. 5" | FN-M01-1.4.7 |
| EL-M01-S2-055 | hidden-field | hidden | `grade` | FN-M01-1.4.7 |
| EL-M01-S2-056 | label | visible | "No. Kad Pengenalan (Pilihan)" | FN-M01-1.4.8 |
| EL-M01-S2-057 | input | visible | `ic_number`, ph "Cth: 031215101234" | FN-M01-1.4.8 |
| EL-M01-S2-058 | text | visible | "Dilindungi PDPA. Hanya 2 digit terakhir akan dipaparkan." | FN-M01-1.4.8 |
| EL-M01-S2-059 | label | visible | "Sekolah (Pilihan)" | FN-M01-1.4.9 |
| EL-M01-S2-060 | text | conditional (state captured @1280 only) | "SK · Johor" | FN-M01-1.4.9 |
| EL-M01-S2-061 | button | conditional (state captured @1280 only) | fa-times | FN-M01-1.4.9 |
| EL-M01-S2-062 | select | visible | (select) | FN-M01-1.4.9 |
| EL-M01-S2-063 | input | visible | ph "Taip nama sekolah..." | FN-M01-1.4.9 |
| EL-M01-S2-064 | clickable | hidden | (div) | FN-M01-1.4.9 |
| EL-M01-S2-065 | empty-state | conditional (state captured @1280 only) | "Tiada sekolah dijumpai" | FN-M01-1.4.9 |
| EL-M01-S2-066 | hidden-field | hidden | `school_id` | FN-M01-1.4.9 |
| EL-M01-S2-067 | label | visible | "Kata Laluan" | FN-M01-1.4.10 |
| EL-M01-S2-068 | input | visible | `password`, ph "••••••••" | FN-M01-1.4.10 |
| EL-M01-S2-069 | toggle | visible | fa-eye | FN-M01-1.4.10 |
| EL-M01-S2-070 | text | visible | "Minimum 6 aksara" | FN-M01-1.4.10 |
| EL-M01-S2-071 | label | visible | "Sahkan Kata Laluan" | FN-M01-1.4.11 |
| EL-M01-S2-072 | input | visible | `password_confirmation`, ph "••••••••" | FN-M01-1.4.11 |
| EL-M01-S2-073 | toggle | visible | fa-eye | FN-M01-1.4.11 |
| EL-M01-S2-074 | button | visible | "Daftar Sekarang" | FN-M01-1.4.12 |
| EL-M01-S2-075 | text | hidden | "Daftar Sekarang" | FN-M01-1.4.12 |
| EL-M01-S2-076 | text | hidden | "Sedang Mendaftar..." | FN-M01-1.4.12 |
| EL-M01-S2-077 | text | visible | "Sudah ada akaun?" | FN-M01-1.4.13 |
| EL-M01-S2-078 | link | visible | "Log Masuk 🔑" → /login | FN-M01-1.4.13 |
| EL-M01-S2-079 | text | visible | "Mewakili organisasi?" | FN-M01-1.4.14 |
| EL-M01-S2-080 | link | visible | "Daftar sebagai Penaja" → /sponsor/register | FN-M01-1.4.14 |
| EL-M01-S2-081 | link | visible | "Kembali ke Laman Utama" → / | FN-M01-1.4.15 |
| EL-M01-S2-082 | text | visible | "© 2026 PRESTASIPLUS. Platform Pendidikan Malaysia." | FN-M01-1.1.3 |
| EL-M01-S2-083 | button | conditional (state captured @1280 only) | "Sedang Mendaftar..." | FN-M01-1.4.12 |
| EL-M01-S2-084 | card | conditional (state captured @1280 only) | "SEKOLAH JENIS KEBANGSAAN (CINA) AI CHUN" | FN-M01-1.4.9 |
| EL-M01-S2-085 | clickable | conditional (state captured @1280 only) | "SEKOLAH JENIS KEBANGSAAN (CINA) AI CHUN SK · Johor · PPD SEGAMAT" | FN-M01-1.4.9 |
| EL-M01-S2-086 | text | conditional (state captured @1280 only) | "SEKOLAH JENIS KEBANGSAAN (CINA) AI CHUN" | FN-M01-1.4.9 |

#### S3 — `/password/reset` (14 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M01-S3-001 | card | visible | "Lupa Kata Laluan?" | FN-M01-1.5.1 |
| EL-M01-S3-002 | text | visible | "🔑" | FN-M01-1.5.1 |
| EL-M01-S3-003 | heading | visible | "Lupa Kata Laluan?" | FN-M01-1.5.1 |
| EL-M01-S3-004 | text | visible | "Masukkan email anda dan kami akan hantar pautan untuk reset kata lalua" | FN-M01-1.5.1 |
| EL-M01-S3-005 | form | visible | POST /password/email | FN-M01-1.5.3 |
| EL-M01-S3-006 | hidden-field | hidden | `_token` | FN-M01-1.5.3 |
| EL-M01-S3-007 | label | visible | "Alamat Email" | FN-M01-1.5.2 |
| EL-M01-S3-008 | input | visible | `email`, ph "nama@email.com" | FN-M01-1.5.2 |
| EL-M01-S3-009 | button | visible | "Hantar Pautan Reset" | FN-M01-1.5.3 |
| EL-M01-S3-010 | text | hidden | "Hantar Pautan Reset" | FN-M01-1.5.3 |
| EL-M01-S3-011 | text | hidden | "Menghantar..." | FN-M01-1.5.3 |
| EL-M01-S3-012 | link | visible | "Kembali ke Log Masuk" → /login | FN-M01-1.5.4 |
| EL-M01-S3-013 | text | visible | "© 2026 PRESTASIPLUS. Platform Pendidikan Malaysia." | FN-M01-1.1.3 |
| EL-M01-S3-014 | button | conditional (state captured @1280 only) | "Menghantar..." | FN-M01-1.5.3 |

#### S4 — `/password/reset/{token}` (21 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M01-S4-001 | card | visible | "Reset Kata Laluan" | FN-M01-1.6.1 |
| EL-M01-S4-002 | text | visible | "🔒" | FN-M01-1.6.1 |
| EL-M01-S4-003 | heading | visible | "Reset Kata Laluan" | FN-M01-1.6.1 |
| EL-M01-S4-004 | text | visible | "Masukkan kata laluan baru anda." | FN-M01-1.6.1 |
| EL-M01-S4-005 | form | visible | POST /password/reset | FN-M01-1.6.6 |
| EL-M01-S4-006 | hidden-field | hidden | `_token` | FN-M01-1.6.6 |
| EL-M01-S4-007 | hidden-field | hidden | `token` | FN-M01-1.6.2 |
| EL-M01-S4-008 | label | visible | "Alamat Email" | FN-M01-1.6.3 |
| EL-M01-S4-009 | input | visible | `email`, ph "nama@email.com" | FN-M01-1.6.3 |
| EL-M01-S4-010 | label | visible | "Kata Laluan Baru" | FN-M01-1.6.4 |
| EL-M01-S4-011 | input | visible | `password`, ph "Minimum 6 aksara" | FN-M01-1.6.4 |
| EL-M01-S4-012 | toggle | visible | fa-eye | FN-M01-1.6.4 |
| EL-M01-S4-013 | label | visible | "Sahkan Kata Laluan" | FN-M01-1.6.5 |
| EL-M01-S4-014 | input | visible | `password_confirmation`, ph "Taip semula kata laluan" | FN-M01-1.6.5 |
| EL-M01-S4-015 | toggle | visible | fa-eye | FN-M01-1.6.5 |
| EL-M01-S4-016 | button | visible | "Tukar Kata Laluan" | FN-M01-1.6.6 |
| EL-M01-S4-017 | text | hidden | "Tukar Kata Laluan" | FN-M01-1.6.6 |
| EL-M01-S4-018 | text | hidden | "Menukar..." | FN-M01-1.6.6 |
| EL-M01-S4-019 | link | visible | "Kembali ke Log Masuk" → /login | FN-M01-1.6.7 |
| EL-M01-S4-020 | text | visible | "© 2026 PRESTASIPLUS. Platform Pendidikan Malaysia." | FN-M01-1.1.3 |
| EL-M01-S4-021 | button | conditional (state captured @1280 only) | "Menukar..." | FN-M01-1.6.6 |

#### S5 — `/password/reset-ic` (16 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M01-S5-001 | card | visible | "Reset Melalui No IC" | FN-M01-1.7.1 |
| EL-M01-S5-002 | heading | visible | "Reset Melalui No IC" | FN-M01-1.7.1 |
| EL-M01-S5-003 | text | visible | "Masukkan email dan No Kad Pengenalan yang didaftarkan dalam profil and" | FN-M01-1.7.1 |
| EL-M01-S5-004 | form | visible | POST /password/reset-ic | FN-M01-1.7.4 |
| EL-M01-S5-005 | hidden-field | hidden | `_token` | FN-M01-1.7.4 |
| EL-M01-S5-006 | label | visible | "Alamat Email" | FN-M01-1.7.2 |
| EL-M01-S5-007 | input | visible | `email`, ph "nama@email.com" | FN-M01-1.7.2 |
| EL-M01-S5-008 | label | visible | "No Kad Pengenalan" | FN-M01-1.7.3 |
| EL-M01-S5-009 | input | visible | `ic_number`, ph "000101010000" | FN-M01-1.7.3 |
| EL-M01-S5-010 | text | visible | "Tanpa tanda sempang (-). Contoh: <digits:12>" | FN-M01-1.7.3 |
| EL-M01-S5-011 | button | visible | "Reset Kata Laluan" | FN-M01-1.7.4 |
| EL-M01-S5-012 | text | hidden | "Reset Kata Laluan" | FN-M01-1.7.4 |
| EL-M01-S5-013 | text | hidden | "Memproses..." | FN-M01-1.7.4 |
| EL-M01-S5-014 | link | visible | "Kembali ke Log Masuk" → /login | FN-M01-1.7.5 |
| EL-M01-S5-015 | text | visible | "© 2026 PRESTASIPLUS. Platform Pendidikan Malaysia." | FN-M01-1.1.3 |
| EL-M01-S5-016 | button | conditional (state captured @1280 only) | "Memproses..." | FN-M01-1.7.4 |

#### S7 — `/profile` (8 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M01-S7-001 | text | hidden | "LIVE:" | EXCLUDED — global tournament banner (`tournamentBanner()`), owned by M16 |
| EL-M01-S7-002 | text | hidden | "MAIN" | EXCLUDED — global tournament banner (`tournamentBanner()`), owned by M16 |
| EL-M01-S7-003 | text | hidden | "DAFTAR" | EXCLUDED — global tournament banner (`tournamentBanner()`), owned by M16 |
| EL-M01-S7-004 | image | visible | (img) | FN-M01-2.1.2 |
| EL-M01-S7-005 | heading | visible | "Admin PRESTASI+" | FN-M01-2.1.2 |
| EL-M01-S7-006 | text | visible | "<email>" | FN-M01-2.1.2 |
| EL-M01-S7-007 | text | visible | "Ahli sejak 6 Februari 2026" | FN-M01-2.1.2 |
| EL-M01-S7-008 | link | visible | "Kemaskini Profil" → /profile/edit | FN-M01-2.1.3 |

#### S8 — `/profile/edit` (74 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M01-S8-001 | text | hidden | "LIVE:" | EXCLUDED — global tournament banner (`tournamentBanner()`), owned by M16 |
| EL-M01-S8-002 | text | hidden | "MAIN" | EXCLUDED — global tournament banner (`tournamentBanner()`), owned by M16 |
| EL-M01-S8-003 | text | hidden | "DAFTAR" | EXCLUDED — global tournament banner (`tournamentBanner()`), owned by M16 |
| EL-M01-S8-004 | card | visible | "Gambar Profil" | FN-M01-2.2.2 |
| EL-M01-S8-005 | heading | visible | "Gambar Profil" | FN-M01-2.2.2 |
| EL-M01-S8-006 | image | visible | (img) | FN-M01-2.2.2 |
| EL-M01-S8-007 | label | conditional (state captured @1280 only) | (label) | FN-M01-2.2.2 |
| EL-M01-S8-008 | form | visible | POST /profile/picture | FN-M01-2.2.3 |
| EL-M01-S8-009 | hidden-field | hidden | `_token` | FN-M01-2.2.3 |
| EL-M01-S8-010 | input | hidden | `profile_picture` | FN-M01-2.2.3 |
| EL-M01-S8-011 | label | visible | "Pilih Gambar" | FN-M01-2.2.2 |
| EL-M01-S8-012 | button | conditional (state captured @1280 only) | "Simpan" | FN-M01-2.2.3 |
| EL-M01-S8-013 | text | visible | "JPG, PNG atau WEBP. Maks 2MB." | FN-M01-2.2.2 |
| EL-M01-S8-014 | form | visible | POST /profile | FN-M01-2.2.12 |
| EL-M01-S8-015 | hidden-field | hidden | `_token` | FN-M01-2.2.12 |
| EL-M01-S8-016 | hidden-field | hidden | `_method` | FN-M01-2.2.12 |
| EL-M01-S8-017 | card | visible | "Maklumat Peribadi" | FN-M01-2.2.4 |
| EL-M01-S8-018 | heading | visible | "Maklumat Peribadi" | FN-M01-2.2.4 |
| EL-M01-S8-019 | label | visible | "Nama Penuh" | FN-M01-2.2.4 |
| EL-M01-S8-020 | input | visible | `name` | FN-M01-2.2.4 |
| EL-M01-S8-021 | label | visible | "Email" | FN-M01-2.2.5 |
| EL-M01-S8-022 | input | visible | (input) | FN-M01-2.2.5 |
| EL-M01-S8-023 | text | visible | "Email tidak boleh diubah" | FN-M01-2.2.5 |
| EL-M01-S8-024 | label | visible | "No. Telefon" | FN-M01-2.2.6 |
| EL-M01-S8-025 | input | visible | `phone`, ph "012-3456789" | FN-M01-2.2.6 |
| EL-M01-S8-026 | label | visible | "Bio / Motto" | FN-M01-2.2.7 |
| EL-M01-S8-027 | textarea | visible | `bio`, ph "Tulis sesuatu tentang diri anda..." | FN-M01-2.2.7 |
| EL-M01-S8-028 | text | visible | "Baki: 500 aksara" (static; never updates) | FN-M01-2.2.7 |
| EL-M01-S8-029 | label | visible | "Tahap" | FN-M01-2.2.8 |
| EL-M01-S8-030 | text | visible | "Sekolah Rendah" (displayed "SEKOLAH RENDAH" via CSS) | FN-M01-2.2.8 |
| EL-M01-S8-031 | label | visible | "Darjah 1" | FN-M01-2.2.8 |
| EL-M01-S8-032 | radio | hidden | `grade` | FN-M01-2.2.8 |
| EL-M01-S8-033 | label | visible | "Darjah 2" | FN-M01-2.2.8 |
| EL-M01-S8-034 | radio | hidden | `grade` | FN-M01-2.2.8 |
| EL-M01-S8-035 | label | visible | "Darjah 3" | FN-M01-2.2.8 |
| EL-M01-S8-036 | radio | hidden | `grade` | FN-M01-2.2.8 |
| EL-M01-S8-037 | label | visible | "Darjah 4" | FN-M01-2.2.8 |
| EL-M01-S8-038 | radio | hidden | `grade` | FN-M01-2.2.8 |
| EL-M01-S8-039 | label | visible | "Darjah 5" | FN-M01-2.2.8 |
| EL-M01-S8-040 | radio | hidden | `grade` | FN-M01-2.2.8 |
| EL-M01-S8-041 | label | visible | "Darjah 6" | FN-M01-2.2.8 |
| EL-M01-S8-042 | radio | hidden | `grade` | FN-M01-2.2.8 |
| EL-M01-S8-043 | card | visible | "Maklumat Sekolah" | FN-M01-2.2.9 |
| EL-M01-S8-044 | heading | visible | "Maklumat Sekolah" | FN-M01-2.2.9 |
| EL-M01-S8-045 | text | visible | "Pilih sekolah anda untuk sambung dengan rakan sekelas" | FN-M01-2.2.9 |
| EL-M01-S8-046 | text | visible | "SEKOLAH KEBANGSAAN KAMPONG CHAMEK" | FN-M01-2.2.9 |
| EL-M01-S8-047 | text | visible | "SK" | FN-M01-2.2.9 |
| EL-M01-S8-048 | text | visible | "·" | FN-M01-2.2.9 |
| EL-M01-S8-049 | text | visible | "Johor" | FN-M01-2.2.9 |
| EL-M01-S8-050 | text | visible | "·" | FN-M01-2.2.9 |
| EL-M01-S8-051 | text | visible | "PPD KLUANG" | FN-M01-2.2.9 |
| EL-M01-S8-052 | button | visible | fa-times-circle | FN-M01-2.2.9 |
| EL-M01-S8-053 | select | conditional (state captured @1280 only) | (select) | FN-M01-2.2.10 |
| EL-M01-S8-054 | input | conditional (state captured @1280 only) | ph "Taip nama sekolah (min. 2 huruf)..." | FN-M01-2.2.10 |
| EL-M01-S8-055 | clickable | hidden | "· ·" | FN-M01-2.2.10 |
| EL-M01-S8-056 | empty-state | conditional (state captured @1280 only) | "Tiada sekolah dijumpai" | FN-M01-2.2.10 |
| EL-M01-S8-057 | text | conditional (state captured @1280 only) | "Cuba tukar negeri atau kata kunci lain" | FN-M01-2.2.10 |
| EL-M01-S8-058 | hidden-field | hidden | `school_id` | FN-M01-2.2.9 |
| EL-M01-S8-059 | link | visible | "Kembali" → /profile | FN-M01-2.2.11 |
| EL-M01-S8-060 | button | visible | "Simpan Profil" | FN-M01-2.2.12 |
| EL-M01-S8-061 | card | visible | "Tukar Kata Laluan" | FN-M01-2.2.13 |
| EL-M01-S8-062 | heading | visible | "Tukar Kata Laluan" | FN-M01-2.2.13 |
| EL-M01-S8-063 | form | visible | POST /profile/password | FN-M01-2.2.14 |
| EL-M01-S8-064 | hidden-field | hidden | `_token` | FN-M01-2.2.14 |
| EL-M01-S8-065 | label | visible | "Kata Laluan Semasa" | FN-M01-2.2.13 |
| EL-M01-S8-066 | input | visible | `current_password` | FN-M01-2.2.13 |
| EL-M01-S8-067 | label | visible | "Kata Laluan Baharu" | FN-M01-2.2.13 |
| EL-M01-S8-068 | input | visible | `password` | FN-M01-2.2.13 |
| EL-M01-S8-069 | text | visible | "Sekurang-kurangnya 8 aksara" | FN-M01-2.2.13 |
| EL-M01-S8-070 | label | visible | "Sahkan Kata Laluan Baharu" | FN-M01-2.2.13 |
| EL-M01-S8-071 | input | visible | `password_confirmation` | FN-M01-2.2.13 |
| EL-M01-S8-072 | button | visible | "Tukar Kata Laluan" | FN-M01-2.2.14 |
| EL-M01-S8-073 | card | conditional (state captured @1280 only) | "SEKOLAH JENIS KEBANGSAAN (CINA) AI CHUN" | FN-M01-2.2.10 |
| EL-M01-S8-074 | clickable | conditional (state captured @1280 only) | "SEKOLAH JENIS KEBANGSAAN (CINA) AI CHUN SK · Johor · PPD SEGAMAT" | FN-M01-2.2.10 |

#### S9 — `/tetapan` (22 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M01-S9-001 | heading | visible | "⚙️ Tetapan Peribadi" | FN-M01-2.3.1 |
| EL-M01-S9-002 | text | visible | "Atur pengalaman PrestasiPlus mengikut keperluan rohani & masa anda." | FN-M01-2.3.1 |
| EL-M01-S9-003 | form | visible | POST /tetapan | FN-M01-2.3.9 |
| EL-M01-S9-004 | hidden-field | hidden | `_token` | FN-M01-2.3.9 |
| EL-M01-S9-005 | hidden-field | hidden | `_method` | FN-M01-2.3.9 |
| EL-M01-S9-006 | heading | visible | "🕌 Mod Rohani" | FN-M01-2.3.2 |
| EL-M01-S9-007 | text | visible | "Personalisasi pembelajaran ikut nilai keagamaan anda. Boleh toggle off" | FN-M01-2.3.2 |
| EL-M01-S9-008 | label | visible | "Aktifkan Mod Rohani Master toggle — kalau off, semua spiritual touchpo" | FN-M01-2.3.3 |
| EL-M01-S9-009 | checkbox | visible | `spiritual_mode` | FN-M01-2.3.3 |
| EL-M01-S9-010 | label | visible | "Tunjuk doa sebelum quiz Splash 2-saat sebelum mula quiz: "Bismillahi t" | FN-M01-2.3.4 |
| EL-M01-S9-011 | checkbox | visible | `show_bismillah_splash` | FN-M01-2.3.4 |
| EL-M01-S9-012 | label | visible | "Push waktu Subuh Push notifikasi pagi awal untuk yang bangun Subuh — 3" | FN-M01-2.3.5 |
| EL-M01-S9-013 | checkbox | visible | `subuh_push_enabled` | FN-M01-2.3.5 |
| EL-M01-S9-014 | input | visible | `subuh_push_time` | FN-M01-2.3.5 |
| EL-M01-S9-015 | label | visible | "Mod Ramadan Push waktu sahur (~4:30am) untuk study sebelum Subuh. Pace" | FN-M01-2.3.6 |
| EL-M01-S9-016 | checkbox | visible | `ramadan_mode_enabled` | FN-M01-2.3.6 |
| EL-M01-S9-017 | input | visible | `sahur_push_time` | FN-M01-2.3.6 |
| EL-M01-S9-018 | heading | visible | "🌍 Latar Agama (opsyen)" | FN-M01-2.3.7 |
| EL-M01-S9-019 | text | visible | "Bagi konteks supaya AI dan content lebih relevan. Tidak diwajibkan." | FN-M01-2.3.7 |
| EL-M01-S9-020 | label | visible | "Agama / kepercayaan Untuk mod rohani yang sesuai. Future: Hindu/Buddhi" | FN-M01-2.3.7 |
| EL-M01-S9-021 | select | visible | `faith` | FN-M01-2.3.7 |
| EL-M01-S9-022 | button | visible | "💾 Simpan Tetapan" | FN-M01-2.3.9 |

#### S10 — `/settings` (7 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M01-S10-001 | text | visible | "404" | FN-M01-2.4.2 |
| EL-M01-S10-002 | text | visible | "🔍" | FN-M01-2.4.2 |
| EL-M01-S10-003 | heading | visible | "Halaman Tidak Dijumpai" | FN-M01-2.4.2 |
| EL-M01-S10-004 | text | visible | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungk" | FN-M01-2.4.2 |
| EL-M01-S10-005 | link | visible | "Halaman Utama" → / | FN-M01-2.4.2 |
| EL-M01-S10-006 | link | visible | "Mula Latihan" → /latih-tubi | FN-M01-2.4.3 |
| EL-M01-S10-007 | text | visible | "PRESTASIPLUS" | FN-M01-2.4.2 |

#### S11 — `/notifikasi` (68 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M01-S11-001 | text | hidden | "LIVE:" | EXCLUDED — global tournament banner (`tournamentBanner()`), owned by M16 |
| EL-M01-S11-002 | text | hidden | "MAIN" | EXCLUDED — global tournament banner (`tournamentBanner()`), owned by M16 |
| EL-M01-S11-003 | text | hidden | "DAFTAR" | EXCLUDED — global tournament banner (`tournamentBanner()`), owned by M16 |
| EL-M01-S11-004 | heading | visible | "Peti Masuk" | FN-M01-3.2.2 |
| EL-M01-S11-005 | badge | visible | "166" | FN-M01-3.2.2 |
| EL-M01-S11-006 | form | visible | POST /notifikasi/read-all | FN-M01-3.2.3 |
| EL-M01-S11-007 | hidden-field | hidden | `_token` | FN-M01-3.2.3 |
| EL-M01-S11-008 | button | visible | "Tanda semua dibaca" | FN-M01-3.2.3 |
| EL-M01-S11-009 | button | visible | "Pilih" | FN-M01-3.2.4 |
| EL-M01-S11-010 | link | visible | "Semua (167)" → /notifikasi | FN-M01-3.2.5 |
| EL-M01-S11-011 | filter | visible | "Belum Dibaca (166)" → /notifikasi?filter=unread | FN-M01-3.2.5 |
| EL-M01-S11-012 | filter | visible | "Sudah Dibaca" → /notifikasi?filter=read | FN-M01-3.2.5 |
| EL-M01-S11-013 | text | visible | "\|" | FN-M01-3.2.6 |
| EL-M01-S11-014 | filter | visible | "Sistem" → /notifikasi?type=system | FN-M01-3.2.6 |
| EL-M01-S11-015 | filter | visible | "Peringatan" → /notifikasi?type=reminder | FN-M01-3.2.6 |
| EL-M01-S11-016 | filter | visible | "Pencapaian" → /notifikasi?type=milestone | FN-M01-3.2.6 |
| EL-M01-S11-017 | label | conditional | "Pilih Semua" | FN-M01-3.3.1 |
| EL-M01-S11-018 | checkbox | conditional | (input) | FN-M01-3.3.1 |
| EL-M01-S11-019 | text | conditional | "20 dipilih" | FN-M01-3.3.3 |
| EL-M01-S11-020 | button | conditional | "Tanda Dibaca" | FN-M01-3.3.4 |
| EL-M01-S11-021 | button | conditional | "Padam" | FN-M01-3.3.5 |
| EL-M01-S11-022 | button | conditional | "Batal" | FN-M01-3.3.6 |
| EL-M01-S11-023 | card | visible | "<masked>" | FN-M01-3.2.7 |
| EL-M01-S11-024 | checkbox | conditional | (input) | FN-M01-3.3.2 |
| EL-M01-S11-025 | clickable | visible | "<masked>" | FN-M01-3.2.8 |
| EL-M01-S11-026 | heading | visible | "<masked>" | FN-M01-3.2.7 |
| EL-M01-S11-027 | button | conditional (state captured @1280 only) | "<masked>" (delete button, title "Padam") | FN-M01-3.2.9 |
| EL-M01-S11-028 | card | visible | "<masked>" | FN-M01-3.2.7 |
| EL-M01-S11-029 | checkbox | conditional | (input) | FN-M01-3.3.2 |
| EL-M01-S11-030 | clickable | visible | "<masked>" | FN-M01-3.2.8 |
| EL-M01-S11-031 | heading | visible | "<masked>" | FN-M01-3.2.7 |
| EL-M01-S11-032 | button | hidden | "<masked>" (delete button, title "Padam") | FN-M01-3.2.9 |
| EL-M01-S11-033 | text | conditional (mobile-only) | "« Previous" | FN-M01-3.2.11 |
| EL-M01-S11-034 | pagination | conditional (mobile-only) | "Next »" → /notifikasi?page=2 | FN-M01-3.2.11 |
| EL-M01-S11-035 | text | visible (desktop-only) | "Showing to of results" | FN-M01-3.2.10 |
| EL-M01-S11-036 | text | visible (desktop-only) | "1" | FN-M01-3.2.10 |
| EL-M01-S11-037 | text | visible (desktop-only) | "20" | FN-M01-3.2.10 |
| EL-M01-S11-038 | text | visible (desktop-only) | "167" | FN-M01-3.2.10 |
| EL-M01-S11-039 | text | visible (desktop-only) | "1" | FN-M01-3.2.10 |
| EL-M01-S11-040 | pagination | visible (desktop-only) | "2" → /notifikasi?page=2 (Go to page 2) | FN-M01-3.2.10 |
| EL-M01-S11-041 | pagination | visible (desktop-only) | "3" → /notifikasi?page=3 (Go to page 3) | FN-M01-3.2.10 |
| EL-M01-S11-042 | pagination | visible (desktop-only) | "4" → /notifikasi?page=4 (Go to page 4) | FN-M01-3.2.10 |
| EL-M01-S11-043 | pagination | visible (desktop-only) | "5" → /notifikasi?page=5 (Go to page 5) | FN-M01-3.2.10 |
| EL-M01-S11-044 | pagination | visible (desktop-only) | "6" → /notifikasi?page=6 (Go to page 6) | FN-M01-3.2.10 |
| EL-M01-S11-045 | pagination | visible (desktop-only) | "7" → /notifikasi?page=7 (Go to page 7) | FN-M01-3.2.10 |
| EL-M01-S11-046 | pagination | visible (desktop-only) | "8" → /notifikasi?page=8 (Go to page 8) | FN-M01-3.2.10 |
| EL-M01-S11-047 | pagination | visible (desktop-only) | "9" → /notifikasi?page=9 (Go to page 9) | FN-M01-3.2.10 |
| EL-M01-S11-048 | pagination | visible (desktop-only) | → /notifikasi?page=2 (Next &raquo;), svg | FN-M01-3.2.10 |
| EL-M01-S11-049 | pagination | hidden | "Next »" → /notifikasi?filter=unread&page=2 | FN-M01-3.2.11 |
| EL-M01-S11-050 | pagination | conditional (state captured @1280 only) | "2" → /notifikasi?filter=unread&page=2 (Go to page 2) | FN-M01-3.2.10 |
| EL-M01-S11-051 | pagination | conditional (state captured @1280 only) | "3" → /notifikasi?filter=unread&page=3 (Go to page 3) | FN-M01-3.2.10 |
| EL-M01-S11-052 | pagination | conditional (state captured @1280 only) | "4" → /notifikasi?filter=unread&page=4 (Go to page 4) | FN-M01-3.2.10 |
| EL-M01-S11-053 | pagination | conditional (state captured @1280 only) | "5" → /notifikasi?filter=unread&page=5 (Go to page 5) | FN-M01-3.2.10 |
| EL-M01-S11-054 | pagination | conditional (state captured @1280 only) | "6" → /notifikasi?filter=unread&page=6 (Go to page 6) | FN-M01-3.2.10 |
| EL-M01-S11-055 | pagination | conditional (state captured @1280 only) | "7" → /notifikasi?filter=unread&page=7 (Go to page 7) | FN-M01-3.2.10 |
| EL-M01-S11-056 | pagination | conditional (state captured @1280 only) | "8" → /notifikasi?filter=unread&page=8 (Go to page 8) | FN-M01-3.2.10 |
| EL-M01-S11-057 | pagination | conditional (state captured @1280 only) | "9" → /notifikasi?filter=unread&page=9 (Go to page 9) | FN-M01-3.2.10 |
| EL-M01-S11-058 | pagination | conditional (state captured @1280 only) | → /notifikasi?filter=unread&page=2 (Next &raquo;), svg | FN-M01-3.2.10 |
| EL-M01-S11-059 | pagination | hidden | "« Previous" → /notifikasi?page=1 | FN-M01-3.2.11 |
| EL-M01-S11-060 | pagination | hidden | "Next »" → /notifikasi?page=3 | FN-M01-3.2.11 |
| EL-M01-S11-061 | pagination | conditional (state captured @1280 only) | → /notifikasi?page=1 (&laquo; Previous), svg | FN-M01-3.2.10 |
| EL-M01-S11-062 | pagination | conditional (state captured @1280 only) | "1" → /notifikasi?page=1 (Go to page 1) | FN-M01-3.2.10 |
| EL-M01-S11-063 | pagination | conditional (state captured @1280 only) | → /notifikasi?page=3 (Next &raquo;), svg | FN-M01-3.2.10 |
| EL-M01-S11-064 | pagination | hidden | "« Previous" → /notifikasi?page=8 | FN-M01-3.2.11 |
| EL-M01-S11-065 | text | hidden | "Next »" | FN-M01-3.2.11 |
| EL-M01-S11-066 | pagination | conditional (state captured @1280 only) | → /notifikasi?page=8 (&laquo; Previous), svg | FN-M01-3.2.10 |
| EL-M01-S11-067 | empty-state | conditional | "Tiada notifikasi" | FN-M01-3.2.12 |
| EL-M01-S11-068 | text | conditional | "Notifikasi baru akan muncul di sini" | FN-M01-3.2.12 |

### 6.2 Shell elements (M01-relevant only)

#### SHU — user portal shell (chrome of S7, S8, S11) — 376 elements, 24 M01-relevant

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M01-SHU-025 | link | visible (desktop-only) | "Tetapan Peribadi" → /tetapan | FN-M01-2.5.1 |
| EL-M01-SHU-119 | link | visible (desktop-only) | "Profil Saya" → /profile | FN-M01-2.5.1 |
| EL-M01-SHU-130 | card | visible (desktop-only) | "Admin PRESTASI+" | FN-M01-2.5.2 |
| EL-M01-SHU-131 | image | visible (desktop-only) | (img) | FN-M01-2.5.2 |
| EL-M01-SHU-132 | text | visible (desktop-only) | "Admin PRESTASI+" | FN-M01-2.5.2 |
| EL-M01-SHU-133 | text | visible (desktop-only) | "<email>" | FN-M01-2.5.2 |
| EL-M01-SHU-134 | link | visible (desktop-only) | → /logout, fa-sign-out-alt | FN-M01-1.8.1 |
| EL-M01-SHU-136 | heading | visible | "Profil Saya" | FN-M01-2.1.1 |
| EL-M01-SHU-137 | text | visible | "Statistik & Pencapaian Anda" | FN-M01-2.1.1 |
| EL-M01-SHU-144 | link | visible | "99+" → /notifikasi | FN-M01-3.1.1 |
| EL-M01-SHU-145 | badge | visible | "99+" | FN-M01-3.1.1 |
| EL-M01-SHU-146 | image | visible (desktop-only) | (img) | FN-M01-2.5.2 |
| EL-M01-SHU-147 | link | visible (desktop-only) | → /logout, fa-sign-out-alt | FN-M01-1.8.1 |
| EL-M01-SHU-167 | image | conditional (mobile-only) | (img) | FN-M01-2.5.2 |
| EL-M01-SHU-168 | text | conditional (mobile-only) | "Admin PRESTASI+" | FN-M01-2.5.2 |
| EL-M01-SHU-169 | text | conditional (mobile-only) | "admin" | FN-M01-2.5.2 |
| EL-M01-SHU-228 | link | conditional (mobile-only) | "Tetapan Peribadi" → /tetapan | FN-M01-2.5.1 |
| EL-M01-SHU-314 | link | conditional (mobile-only) | "Profil Saya" → /profile | FN-M01-2.5.1 |
| EL-M01-SHU-315 | link | conditional (mobile-only) | "Tetapan" → /settings | FN-M01-2.4.1 |
| EL-M01-SHU-317 | link | conditional (mobile-only) | "Log Keluar" → /logout | FN-M01-1.8.1 |
| EL-M01-SHU-373 | heading | conditional | "Kemaskini Profil" | FN-M01-2.2.1 |
| EL-M01-SHU-374 | text | conditional | "Maklumat peribadi & sekolah anda" | FN-M01-2.2.1 |
| EL-M01-SHU-375 | heading | conditional | "Notifikasi" | FN-M01-3.2.1 |
| EL-M01-SHU-376 | text | conditional | "Peti masuk mesej anda" | FN-M01-3.2.1 |

All other SHU elements (352) — IDs 001–024, 026–118, 120–129, 135, 138–143, 148–166, 170–227, 229–313, 316, 318–372 (prefix EL-M01-SHU-): **owned by global shell (docs/discovery/00-global-ui.md) / M23**. The links they carry belong to the modules recorded per URL in `_crawl.json` (e.g. koin/mata/streak chips → M14, chatbot widget → M22, PWA install prompt → global shell, server-status pill → M23, "Ke Dashboard"/"Student View"/"Ke Admin Panel" → M23).

#### SHA — admin panel shell (chrome of S9) — 195 elements, 11 M01-relevant

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M01-SHA-111 | link | visible (desktop-only) | "Tetapan Peribadi" → /tetapan | FN-M01-2.5.1 |
| EL-M01-SHA-113 | card | visible (desktop-only) | "Admin PRESTASI+" | FN-M01-2.5.2 |
| EL-M01-SHA-114 | image | visible (desktop-only) | (img) | FN-M01-2.5.2 |
| EL-M01-SHA-115 | text | visible (desktop-only) | "Admin PRESTASI+" | FN-M01-2.5.2 |
| EL-M01-SHA-116 | text | visible (desktop-only) | "Admin" | FN-M01-2.5.2 |
| EL-M01-SHA-117 | link | visible (desktop-only) | → /logout, fa-sign-out-alt | FN-M01-1.8.1 |
| EL-M01-SHA-118 | heading | visible | "Dashboard" | FN-M01-2.3.8 |
| EL-M01-SHA-119 | text | visible | "Selamat datang, Admin" | FN-M01-2.3.8 |
| EL-M01-SHA-129 | image | visible (desktop-only) | (img) | FN-M01-2.5.2 |
| EL-M01-SHA-130 | link | visible (desktop-only) | → /logout, fa-sign-out-alt | FN-M01-1.8.1 |
| EL-M01-SHA-195 | link | conditional (mobile-only) | "Log Keluar" → /logout | FN-M01-1.8.1 |

All other SHA elements (184) — IDs 001–110, 112, 120–128, 131–194 (prefix EL-M01-SHA-): **owned by global shell (docs/discovery/00-global-ui.md) / M23**. The links they carry belong to the modules recorded per URL in `_crawl.json` (e.g. koin/mata/streak chips → M14, chatbot widget → M22, PWA install prompt → global shell, server-status pill → M23, "Ke Dashboard"/"Student View"/"Ke Admin Panel" → M23).

---

## 7. Fidelity deviations

These are the **only** intended differences from the live site. Anything not listed here must match the live site (D7, D9).

Status per the user's decision of 2026-09-25, **rule D9**: where the live site is broken or contradictory, fix it; where it works, replicate it exactly. Approved fixes are the specified behaviour throughout this URS and the SRS; the "Live behaviour" column is background only.

| ID | Type | Live behaviour (background) | Rebuild behaviour (specified) | Reason | Status |
|---|---|---|---|---|---|
| DV-01 | Broken link | The user-shell mobile drawer's "Tetapan" (EL-M01-SHU-315) links to `/settings`, which is a 404. | The drawer "Tetapan" links to `/tetapan`. Typing `/settings` directly still shows the 404 page, as live. | Dead link; the settings page is `/tetapan`. | Approved (user rule D9, 2026-09-25) |
| DV-02 | Broken link | The 404 page's "Mula Latihan" (EL-M01-S10-006) links to `/latih-tubi`, itself a 404. | "Mula Latihan" links to `/practice` (Latih Tubi, M05). | Dead link. | Approved (user rule D9, 2026-09-25) |
| DV-03 | Contradictory rule | Minimum password length is 6 on register (hint "Minimum 6 aksara", S2-070) and on the reset form (placeholder "Minimum 6 aksara", S4-011), but 8 on the profile password change (hint "Sekurang-kurangnya 8 aksara", S8-069). | **6 everywhere** (the primary-flow value). The profile hint reads "Sekurang-kurangnya 6 aksara". The mock enforces min 6 on register, both resets and change password. (Alternative if the user prefers: 8 everywhere, which changes the register hint and reset placeholder to "Minimum 8 aksara".) | Two contradictory rules for the same password; one value is needed. | Approved (user rule D9, 2026-09-25) |
| DV-04 | Contradictory rule | The IC field is `maxlength=14` on register (S2-057) and `maxlength=20` on the IC reset (S5-009). No format rule exists on either. | `maxlength=14` on both. No other IC validation is added (as live). | Same data, contradictory limits. 14 is the primary-flow (register) value and fits the 12-digit MyKad with or without dashes. | Approved (user rule D9, 2026-09-25) |
| DV-05 | Contradictory rule | Login shows "128,989" questions (S1-010, S1-041); the admin dashboard shows 130,152 "Soalan Aktif". | The login stat is the named query Q-ELIGIBLE (approved ∧ active) of the one M04 dataset (D11; M04 SRS §4.1), so it is 128,989. The other figures are reconciled as different named queries of the same dataset (M04 §4.1: Q-ALL for the M04 admin total, Q-ACTIVE + Q-PKSK for M17 "Soalan Aktif", as in M05 v1.2), so nothing contradicts. Subjects and levels = M03 counts. | Contradictory figures for the same fact. | Approved (user rule D9, 2026-09-25) |
| DV-06 | Contradictory rule (script conflict) | Choosing "Ibu Bapa" hides the IC field, but a fallback script forces "Pilih Tahap Anda" back to visible (screenshot `register-parent-desktop.png`). The hidden `grade` input stays `required=true` for Ibu Bapa too, because the fallback script keeps it (it becomes `false` only for Guru). The markup's own binding is `:required="selectedRole === 'student'"`. | For "Ibu Bapa" the level picker is hidden, as for "Guru", and `grade` is neither required nor submitted. | Two scripts contradict each other. The markup's own rule (level for students only) is kept. | Approved (user rule D9, 2026-09-25) |
| DV-07 | Responsive defect | Auth pages switch to two columns at 768px. At 768 the register form column is about 350px: role subtitles wrap to 3 lines, the state select is clipped ("Negei"), the search placeholder is clipped, and the login stats strip breaks "11 Tahap" onto a second line. | Auth pages stay one centred column (card max 560px) below 1024px and switch to two columns at ≥1024px (`lg`). Stats-strip items wrap as whole items. | Layout defect at tablet width. | Approved (user rule D9, 2026-09-25) |
| DV-08 | Responsive defect | `/tetapan` at 375: rows don't stack (descriptions squeezed to about 100px), and the faith select overflows (page scrollWidth 408 vs 360), causing horizontal page scroll. | Below 640px (`sm`) each control sits under its label, and the select and time inputs are full width. At ≥640px, as live. | Horizontal page scroll (NFR-RESP-01). | Approved (user rule D9, 2026-09-25) |
| DV-09 | — | *Withdrawn in v1.1 (AUD-M01-02).* The claimed overflow of "Simpan Profil" at 375 was not reproduced (button right edge 351px = row edge; no overflow). | Live inline actions row kept at every width. | — | Withdrawn |
| DV-10 | Layout defect | The notification filter strip overflows its container even on desktop and shows a native horizontal scrollbar. | At ≥640px the pills fit or wrap within the 640px column. Below 640px the strip scrolls horizontally inside its own container (as live), with the scrollbar visually hidden. | Visible overflow/scrollbar defect. | Approved (user rule D9, 2026-09-25) |
| DV-11 | Touch defect | The item delete button is opacity 0 and appears only while the pointer is over the button itself (`onmouseenter`), so it is effectively invisible on touch screens. | On devices without hover, and on keyboard focus, the button is always visible. Hover-capable devices keep the live hover reveal. | Function unusable on touch (broken). | Approved (user rule D9, 2026-09-25) |
| DV-12 | Visual state bug | With a category filter (`?type=…`) active, no pill is highlighted ("Semua" loses its highlight and the category pill is not highlighted). | The active category pill uses the same active style as the status pills. | The active filter is not shown (broken). | Approved (user rule D9, 2026-09-25) |
| DV-13 | Wrong copy | `/tetapan` (admin shell) shows the header "Dashboard" / "Selamat datang, Admin" (EL-M01-SHA-118–119). | The header shows "Tetapan Peribadi" with no subtitle: the shell derives the title from the route, and live shows no correct subtitle for this page (`docs/design/shells.md` DV-SH-03 / DV-SH-07). | Stale title from another page (broken). | Approved (user rule D9, 2026-09-25) |
| DV-14 | Contrast defect | On `/profile` the name is slate-800 (rgb 30,41,59) on an indigo→purple gradient. | The name is white, like the other hero text. **Extension (as built, Delivery Lead, D9, 2026-10-02):** the hero email and "Ahli sejak {date}" lines are also white; their live colour was not recorded in discovery (only the name was). Chosen for consistency with the name fix. White on #667EEA is 3.66:1 at the light end of the gradient. | Text unreadable (broken). | Approved (user rule D9, 2026-09-25); extension applied directly (2026-10-02) |
| DV-15 | Accessibility improvement | The register role cards and grade buttons are `div`s with click handlers, with no keyboard or ARIA support. | **Replicate live**: click/tap targets without keyboard semantics. | It works for mouse and touch; this would be an improvement, not a fix. | Rejected — replicate live (user rule D9, 2026-09-25) |
| DV-16 | Unreadable text | Some M01 text is rendered below 12px on live (e.g. the notification type-code badge, the grade-card sub-labels "Darjah" / "Ting.", the "(Pilihan)" and hint lines where smaller than 12px; exact sizes to be confirmed at the next audit, XL-22). | Every M01 content text renders at 12px minimum. Weight, colour and copy are unchanged. Same rule as M02 DV-01, M03 DV-06 and M05 DV-11. | Text below 12px is unreadable (master NFR-02, D9 "unreadable text"). | Approved (rule D9, applied directly; Delivery Lead XL-22, 2026-09-25) |
| DV-17 | Privacy (personal name) | The register "Nama Penuh" placeholder is a person-like name (EL-M01-S2-029). | The placeholder is the generic "Muhammad Fulan bin Fulan". | Privacy overrides fidelity for personal names (CLAUDE.md §6); no real person's name is written to the repo. | Applied directly (privacy rule, 2026-09-30) |
| DV-18 | Privacy (personal data) | The S5 "No Kad Pengenalan" placeholder and hint example (EL-M01-S5-009, FN-M01-1.7.3, AC-M01-12.1) is a 12-digit IC that may be real personal data. | The example is the fictitious `000101010000` (serial 0000 is never issued). | Privacy overrides fidelity for personal data (CLAUDE.md §6). | Applied directly (privacy rule, 2026-09-30) |
| DV-19 | Layout defect (touch target, clipped text) | S8 Tahap Darjah grid is 6 columns at every width; at 320px each card is about 38.7px wide (under 44px) and the sub-label "Darjah" is clipped. | The grid is 3 columns below 360px and 6 columns from 360px (375, 768 and 1280 keep the live 6 columns). Alternatives: keep 6 (broken), 2 columns; 3 chosen as the minimal change. | Controls unusable on touch and clipped text (broken). | Applied directly (rule D9, Delivery Lead, 2026-10-02) |
| DV-25 | Broken flow (roster login, AM2-A1b) | The S1 identifier field is `type=email` (FN-M01-1.2.2, SRS FR-M01-03), labelled "Alamat Email" (placeholder `nama@email.com`, `autocomplete=email`). In the v2 http mode the login API (`POST /api/auth/login`, field `identifier`) accepts an e-mail or a username, and roster pupils have a username and no e-mail, but the browser's native e-mail check blocks a username before any request is sent. | The field is `type=text`, `autocomplete=username`, still `required` and with the same `name`, test id, icon, placeholder (`nama@email.com`) and layout; the label reads "Alamat Email / Nama Pengguna" (Perlu pengesahan). The value is sent unchanged as `identifier` in http mode. A username that exists in several schools gets 422 `AMBIGUOUS_USERNAME`, whose server message is shown in the existing red alert (no school picker; out of scope). Mock mode is unchanged: the mock user store has no usernames, so a username there gets the usual "Email atau kata laluan tidak sah.". Alternatives: keep `type=email` (roster login unusable), add `novalidate` (breaks FR-M01-08 for the password field), a separate "Nama Pengguna" field (new scope); the `type=text` change is the minimal one. | Roster pupils cannot log in through the form (broken flow). | Applied directly (rule D9, AM2-A1b) |

Explicitly **not** deviations: these are replicated as live even though they could be seen as weaknesses.
- The browser-native English validation bubbles.
- The decorative stepper.
- The ignored intended URL.
- Guest pages that stay reachable while logged in.
- Logout by GET with no message.
- No success flash after login.
- The raw uppercase notification type codes.
- The native `confirm()` dialogs.
- The English Laravel pagination text.
- No "searching" indicator and silent search errors on the profile school picker.
- No client-side dependencies on `/tetapan`.
- The static bio counter "Baki: 500 aksara" (AUD-M01-01).

Security concerns are recorded for the backend phase (SRS NFR-M01-04), not as deviations.

---

## 8. Out of scope

| Item | Owner / reason |
|---|---|
| Public landing page `/` (link target of "Kembali ke Laman Utama" and "Halaman Utama") | Out of project scope. The prototype routes `/` to a minimal placeholder so the links work. |
| `/sponsor/register` | M21 (the link is in M01). |
| Sending notifications, push scheduling for the Subuh/sahur times, admin push screen | M22. M01 stores the preferences and shows the inbox. |
| Gamification header chips (koin, mata, streak), tournament banner, chatbot widget, PWA install prompt, server-status pill | M14, M16, M22, global shell, M23. |
| Admin ⇄ student view switch ("Ke Dashboard", "Student View", "Ke Admin Panel"), rest of the sidebar/drawer menus | M23 / global shell. |
| Landing pages (`/admin`, `/dashboard`, `/guru`, `/ppd/dashboard`, …) | M17, M05, M10, M18 respectively. M01 only routes the user there. |
| Creating accounts for `school_admin`, `ppd_officer`, `jpn_officer`, `sponsor`, `admin`; activating/deactivating users; parent↔child linking; user administration | M02. |
| Real email, sessions, password hashing, throttling, CSRF | Backend phase (D1). The prototype simulates the user-visible behaviour. |
| Email verification, 2FA, password confirmation screens | Not present on the live site (all probed routes return 404). |

---

## 9. Open questions

Only questions that cannot be answered by following the live site.

1. **OQ-1 Post-submit results and messages (INFERRED; UNVERIFIED COPY).** These could not be observed read-only:
   - the success and error text and placement for register, forgot password, token reset, IC reset, profile save, picture upload, password change and `/tetapan` save;
   - read-all and the bulk read/delete reloads;
   - the login throttle.

   The prototype uses Laravel-default wording or placeholders (SRS §8). *Suggestion:* a validation-failure probe (for example registering with mismatched passwords, or requesting a reset for a non-existent email) changes no data. It needs the user's permission, because the discovery rules forbid submitting.
2. **OQ-2 IC reset after a match (inferred).** Is the user redirected to the set-new-password form (assumed), given a temporary password, or something else?
3. **OQ-3 Landing page per role (inferred).** Only admin → `/admin` is observed. Assumed: `ppd_officer` → `/ppd/dashboard`, `jpn_officer` → `/jpn/dashboard`, `school_admin` and all other roles → `/dashboard`. M02 records no landing pages.
4. **OQ-4 `/profile` for non-admin roles (inferred).** Which stats and achievements appear under "Statistik & Pencapaian Anda", and when is the crown badge shown? Only the admin view is known, and the prototype shows that view for every role.
5. **OQ-5 Profile "Tahap" (inferred).** The admin sees only "Sekolah Rendah" Darjah 1–6. Is the group chosen by the user's current level? Is it shown to non-students?
6. **OQ-6 `/tetapan` shell for non-admin roles (inferred).** Admin sees the admin shell. Is it the user shell for other roles? The prototype assumes the user shell (as built for Murid, Guru and Admin Sekolah; still INFERRED).
7. **OQ-7 Peti Masuk pill at zero (inferred).** Is the S11 "Peti Masuk" unread pill hidden when the count is 0? The prototype assumes hidden. (The header badge is answered: its script hides it at 0, AUD-M01-09.)
8. **OQ-8 Notification type codes.** Three codes are observed (`chatbot_new_conversation`, `spaced_review`, `new_ticket`). What is the full list, and how do codes map to the system/reminder/milestone filter categories? The admin's items match none of the categories. Shared with M22.
9. **OQ-9 Remember-me duration.** How long does the "Ingat saya" cookie last? (Assumed: Laravel's long-lived default.) The 120 min session without "Ingat saya" is observed.

**Answered by M02 (v1.3):**
- *Parent ↔ child linking* (earlier open question on how a parent is linked to a child): answered by M02. An admin links a parent to one or more students (many-to-many `ParentStudentLink`, M02 create/edit forms). There is no parent self-service. M01 registration stays unchanged (no linking), as live.
- *School type taxonomy* (earlier question on coarse or wrong school types): answered by M02. The school form enum is SK, SMK, SJK(C), SJK(T), MRSM, SBP; live data holds only SK/SMK (M02 D-12). M01 displays whatever type M02 stores.
