# M01 — Authentication & Account — Software Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | SRS — M01 Authentication & Account |
| Version | 1.17 |
| Date | 2026-10-10 |
| Status | Approved (G1) — v1.17, doc-only: as-built `PUT /api/me` staff school rule (BR-30) and logout revoking impersonation child sessions (BR-31), from M27 Part B commit `c5e1a7f`; v1.16, doc-only: Q8 closed (D23c) and a cross-reference to the L45 acceptance page (D23b); v1.15: as-built decisions from the G4 reviews of M01-T5a, T6 and T7a (DV-14 extension, DV-19, INFERRED S8/S9 states, SEC-M01-13…23) |
| Authors | product-analyst (functional: §1–5, §8–10, §12–13) · solution-architect (data entities & mock API: §6–7, NFR §11) |
| Source URS | [urs/M01-authentication.md](../urs/M01-authentication.md) (v1.13: 111 Functions, 26 stories, 101 active ACs, coverage 363/363) |
| Source discovery | [M01-authentication.md](../../discovery/M01-authentication.md), [inventory/M01/](../../discovery/inventory/M01/), [00-global-ui.md](../../discovery/00-global-ui.md) |

**Change log**

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-09-25 | First draft (superseded; its "Decisions needed" list is withdrawn). |
| 0.2 | 2026-09-25 | Rewrite under D7/D8: the live behaviour is specified as-is. FRs trace to Functions (FN) and stories. The only intended differences are the fidelity deviations DV-01…DV-15 in URS §7. Post-submit results that could not be observed are specified as INFERRED (Laravel defaults) with UNVERIFIED COPY. |
| 1.1 | 2026-09-25 | **Revision history — v1.1, audit fixes** (`docs/qa/audit/M01-audit.md`). AUD-M01-01: static bio counter (FR-39, §8, E2E-28). AUD-M01-02: DV-09 withdrawn (§10 S8, E2E-47). AUD-M01-03: "Padam" tooltip (FR-61). AUD-M01-04: badge refresh on load, every 60 s and on push (FR-53, FR-59, new E2E-49). AUD-M01-05: 🎒 moved to the welcome panel (FR-01, FR-15). AUD-M01-06: uppercase headings (FR-20, FR-40). AUD-M01-07: admin seed Darjah 4 + `spaced_review`. AUD-M01-08: 120 min session OBSERVED (BR-06). AUD-M01-09: zero-count badge OBSERVED. AUD-M01-10: `grade` required note. AUD-M01-11: DV-11…DV-15 default to replicating live; the fixes are alternatives if the user approves (FR-19/20/38/47/55/61/66, NFR-05, E2E-26/33/38/43/48). AUD-M01-12: district wording (E2E-15). |
| 1.2 | 2026-09-25 | **Revision history — v1.2, user decision (rule D9).** DV-01…08, DV-10…DV-14 approved; their fixes are now the specified behaviour (FR-38, FR-47, FR-55, FR-61, FR-65, §10, E2E-26/33/38/43). DV-15 rejected: replicate live (FR-19, FR-20, FR-66, NFR-05, E2E-48). DV-09 stays withdrawn. Status Approved (G1). |
| 1.3 | 2026-09-25 | **Revision history — v1.3, cross-module alignment with M02.** Role enum = the 8 observed codes (BR-07, §6.1, §6.7, §6.8 seeds, §7, §9). `ppd`/`jpn`/`duta`/`seller`/`tuition_centre` are removed. Inactive-login refusal added (BR-23, FR-M01-68, E2E-M01-50, §5, §8). IC rule scoped to self/non-admin endpoints (NFR-M01-03, §6.1; admin endpoints per M02 SEC-M02-07). DATA-M01-01 aligned with and referencing DATA-M02-01. Q4/Q5 answered by M02. |
| 1.4 | 2026-09-25 | **Revision history — v1.4, cross-module alignment with M02 (school search).** Endpoint #20 `/api/schools/search` aligned with the M02 audit: default 20 results, no enforced maximum, `id` parameter supported, active schools only; owned by M02. FR-22/FR-43 keep the observed client limits (15 on register, 20 on profile). Rechecked: inactive-login refusal (BR-23/FR-68/E2E-50), IC scope (NFR-M01-03) and INFERRED landing pages (BR-07, URS OQ-3) are already covered. |
| 1.5 | 2026-09-25 | **Revision history — v1.5, cross-module alignment (integer user ids for M07/M08).** User, Notification and SchoolSummary ids are now integers, because the live site exposes numeric ids (`/pelajar/1`, notification `data-id`, `/api/schools/search` `id:number`, `?school=987`); this follows the SRS.md §7.4 numeric-id exception. Every mock API shape uses `number` ids. Seed accounts have fixed integer ids (§6.8, admin = 1). New seed account `pelajarmaju@demo.test` (id 4). The admin grade is unchanged while the live check is pending. |
| 1.6 | 2026-09-25 | **Revision history — v1.6, cross-module logic review fixes** (`docs/qa/audit/cross-module-logic-M01-M07.md`; D11, D12). XL-02: login stats are derived (question total = M04 dataset total per D11 / DV-05; subjects and levels = M03 counts), with no stored constant (§6.6, FR-11, BR-21, API #21, E2E-01). XL-14: id 4 is grade 1 (Darjah 1) at SK Demo. XL-15/XL-26: ids 5 and 8 are at the canonical coded SMK. XL-27: new-user defaults (BR-24, E2E-17). XL-22: minimum text size 12px (DV-16, FR-65, E2E-47, AC-26.7). XL-20: DV-13 follows shells.md DV-SH-03/DV-SH-07. XL-25: stale Q6 closed. **Addendum (v1.6, wording only):** the admin grade Darjah 4 is now recorded as OBSERVED by the M08 live check, with a note that the /pelajar/1 "Darjah 6" chip is a separate M08 field; the v1.5 "pending" note is resolved. |
| 1.7 | 2026-09-25 | **Revision history — v1.7, user-id alignment with M02 v1.4 (§6.15).** Users are a D11 virtual dataset with live-range ids 1–6,000. Canonical accounts 1–11 (unchanged) and M02 fixtures 5001–5999 are anchors inside it. The "new users start at 1000" rule is replaced: runtime-created users get ids from 9,000,001 upward, in creation order, never reused (owner: M02 SRS §6.15) (DATA-M01-01, §6.8, BR-24, E2E-17). |
| 1.8 | 2026-09-25 | **Revision history — v1.8, XL round 2** (`docs/qa/audit/cross-module-logic-M01-M07.md` Round 2). XL-02: the login question stat is the named query **Q-ELIGIBLE** (M04 SRS §4.1: status approved ∧ active = 128,989). The wording "M04 dataset total / M04 S1 Jumlah / M17 Soalan Aktif" is removed; those are different named queries (Q-ALL 465,278; Q-ACTIVE + Q-PKSK 130,152). Affects FR-11, BR-21, §6.6, §6.8, E2E-01. XL-38: M01 no longer seeds schools; it references the M02 schools dataset (D11, M02 §6.15), with canonical schools 900001 (SMK DEMO) and 900002 (SK Demo). |
| 1.9 | 2026-09-26 | **Revision history — v1.9, XL batch 2** (`docs/qa/audit/cross-module-logic-M08-M11.md`, XL2-07; M11 XR-M11-01). Adds `User.lastLoginAt` (datetime, nullable) to DATA-M01-01, set by every successful login from the mock clock (BR-25, API #1, E2E-03). Seeds carry values for the canonical accounts (§6.8); M02 seeds its fixtures, including 3001–3008 per M11 §6.8. No other M01 item is assigned by the report. |
| 1.10 | 2026-09-27 | **Revision history — v1.10.** (1) Delivery Lead decision on XR-M08-01: canonical id 4 (pelajarmaju) leaves school 900002 for **5441 SEKOLAH KEBANGSAAN AMBUAL** (an existing SK already in the 60 filter schools; set by M02 v1.15), so the admin's school 900002 keeps the observed 0 pupils on M08 S9; the admin stays at 900002. (2) XL3-09 (`docs/qa/audit/cross-module-logic-M12-M18.md`, M14 XR-M14-02): the M14 `onLogin` hook runs after each password login (FR-M01-69, BR-26, AC-01.7, E2E-51, with the XL3-30 post-login chip values); a provisional referral path carries `?ref=` into the register call without a form field (FR-M01-70, BR-22, AC-06.5, E2E-13). (3) F-11 as-built decisions: designed `createdAt`/`updatedAt` 2026-02-06T09:00:00+08:00 for accounts 1–11 (only the admin's date is observed); `recordLogin` leaves `updatedAt` unchanged; passwords and ICs are persisted only as salted SHA-256 hashes; sessions slide at most once per minute; tokens are random outside e2e (§6.1, §6.2, BR-06, BR-12, BR-25, NFR-M01-03/04). Q7 (IC hash vs M02 full-IC display) decided and closed: secrets store `{passwordHash, icHash, icMasked, salt}`, `icMasked` in the live mask format, `verifyIc` by hash, full IC only for seeded accounts via `adminIcNumber`, runtime ICs masked for admins (M02 SEC-M02-07 note). |
| 1.11 | 2026-09-27 | **Revision history — v1.11, account 4 school (XL3 round 2, R2-01).** Canonical id 4 (pelajarmaju) is at fixture school **900004 "SK Demo Bestari"** (SK, Johor; M02 v1.16), replacing the v1.10 value 5441 "SEKOLAH KEBANGSAAN AMBUAL", which would have changed M17's observed values. The admin stays at 900002. |
| 1.12 | 2026-09-27 | **Revision history — v1.12, M02 v1.23 change request XR-M02-03.** (1) Canonical seed account 11 (tidakaktif) moves from no school ("—") to **9167 SEKOLAH MENENGAH KEBANGSAAN GHAFAR BABA** (Melaka; M02 §6.15 D); grade 7 unchanged; still inactive, never logged in, no class, no answers, so no observed value changes (login refused per BR-23 before any school is shown). (2) §6.1: the users repository lists `users.setSubscription(userId, {package, expiresAt})` (M02 BR-12, XR-M19-04): M02 owns the fields; the M02 S3 save computes the expiry with M19 `billing.computeExpiry`. No M01 FR, BR, endpoint or E2E count changes. |
| 1.13 | 2026-09-30 | **Revision history — v1.13, G4 security review (doc-only).** (1) New §14 "Real-backend security requirements (from G4 security review, 2026-09-30)": six backend-only items; the prototype replicates live (D9) and the mock is unchanged. (2) Three INFERRED notes from code review added as BR-27, BR-28, BR-29 (§4). No observed copy or behaviour changed; no FR, endpoint or E2E count changes. |
| 1.14 | 2026-09-30 | **Revision history — v1.14, privacy replacement and INFERRED notes (doc-only).** (1) Privacy rule: the live register name placeholder is a person-like name; replaced with the generic "Muhammad Fulan bin Fulan" (FR-M01-16; new DV-17 in §0.1). The live IC example (S5 placeholder and hint, FR-M01-33, §8) may be real personal data and is replaced with the fictitious `000101010000` (new DV-18). (2) §8: generic error line "Ralat berlaku. Sila cuba lagi." (INFERRED, UNVERIFIED COPY) and two S4 INFERRED notes (fields cleared after a failed reset; success flash passes through). (3) §10: S2 at 320px note (state select and school search side by side; placeholder truncated, follows live). No FR, endpoint or E2E count changes. |
| 1.15 | 2026-10-02 | **Revision history — v1.15, as-built decisions from the G4 reviews of M01-T5a (logout / user shell), M01-T6 (profile) and M01-T7a (tetapan) (doc-only).** (1) §0.1: DV-14 extended to the S7 hero email and "Ahli sejak" lines (white; live colour not recorded; 3.66:1 at the light end); new DV-19 (S8 Tahap Darjah grid is 3 columns below 360px). (2) §2 / §8: S9 for Murid, Guru and Admin Sekolah renders in the user shell as built (OQ-6, still INFERRED); new INFERRED states: S9 load spinner, S9 load-error alert with "Cuba lagi", S8/S9 saving state (button label kept, spinner replaces the icon, button disabled); "Tetapan berjaya disimpan." stays UNVERIFIED COPY. (3) §10 S7/S8 rows and NFR-M01-05 (accessibility as built, D10; avatar note). (4) §13: avatar-source decision pending (Q8) and the missing hero-gradient design token (Q9). (5) §14: new SEC-M01-13…23 (logout, cache control, token storage, push channel, cross-tab logout, faith data, settings API, body parsing, password change, `PUT /api/me`, school search); SEC-M01-10 (profile picture) extended in place. All backend-only; prototype replicates live. No FR, endpoint or E2E count changes. |
| 1.16 | 2026-10-02 | **Revision history — v1.16, user decision D23 (doc-only).** (1) Q8 closed (D23c): the initials avatar keeps the shell's local SVG data URL (`src/shells/shared/avatar.ts`); no external ui-avatars.com call (D4); BR-15 colours and sizes unchanged. (2) Cross-reference (D23b): the guest-reachable invite acceptance page `/ibu-bapa/terima/:token` and the parent login/register hand-off are owned by M01 and specified in [L45-jemput-ibu-bapa.md](L45-jemput-ibu-bapa.md) (S2, FR-L45-19…30). It is a public, standalone route (no auth guard, like S1–S5), so it joins the public routes of FR-M01-14; login and register behaviour, BR-04, BR-07 and BR-08 are unchanged (after login or registration a parent lands on `/dashboard` and reopens the link). Q4 gains a note. The §2 route table and §9 permissions table are updated at the next M01 revision (L45 XR-L45-05). No FR, endpoint or E2E count changes. |
| 1.17 | 2026-10-10 | **Revision history — v1.17, as-built security fixes from M27 Part B (commit `c5e1a7f`, G4 passed; doc-only).** (1) New BR-30: `PUT /api/me` ignores `schoolId` for the roles `school_admin`, `ppd_officer`, `jpn_officer` and `admin`; the role is read from the stored user, never from the request (endpoint #8 note). (2) New BR-31: `POST /api/auth/logout` also ends the impersonation child sessions opened from the logged-out session (endpoint #6 note). No observed copy changed; no FR, endpoint or E2E count changes. |

**Tags:** **OBSERVED** · **INFERRED** (the most likely live behaviour, usually a Laravel default) · **UNVERIFIED COPY** (message text not captured; placeholder until verified, URS OQ-1) · **DV-nn** (fidelity deviation, URS §7, pending the user's decision).

### 0.1 Fidelity deviations referenced here

This SRS implements the live site plus only the deviations in URS §7.

**Approved (user rule D9, 2026-09-25) — specified as the behaviour in this SRS:**
- DV-01 drawer "Tetapan" → `/tetapan`;
- DV-02 404 "Mula Latihan" → `/practice`;
- DV-03 password min 6 everywhere;
- DV-04 IC maxlength 14 on both forms;
- DV-05 one statistics source;
- DV-06 no level picker for Ibu Bapa;
- DV-07 auth pages two-column only at ≥1024px;
- DV-08 `/tetapan` stacks below 640px;
- ~~DV-09~~ withdrawn in v1.1 (AUD-M01-02): the live inline actions row is kept;
- DV-10 no native scrollbar on the notification filters;
- DV-11 delete button always visible on touch devices and on keyboard focus;
- DV-12 active category pill highlighted;
- DV-13 `/tetapan` admin header reads "Tetapan Peribadi";
- DV-14 profile name in white. **Extension (as built, Delivery Lead, D9, 2026-10-02):** the S7 hero email and "Ahli sejak {date}" lines are also white on the #667EEA→#764BA2 gradient. The live colour of those two lines was not recorded in discovery (only the name: slate-800 on purple, low contrast). Chosen for consistency with the name fix. Note: white on #667EEA is 3.66:1 at the light end of the gradient;
- DV-16 text below 12px raised to 12px (XL-22);
- DV-17 the live register name placeholder is a person-like name; replaced under the privacy rule with the generic "Muhammad Fulan bin Fulan" (privacy overrides fidelity; recorded in the URS §7 table);
- DV-18 the live IC example on S5 (placeholder and hint "Contoh: …") may be real personal data; replaced under the privacy rule with the fictitious `000101010000` (serial 0000 is never issued) (FR-M01-33, §8; recorded in the URS §7 table);
- DV-19 (as built, Delivery Lead, D9, 2026-10-02) S8 Tahap Darjah grid is 3 columns below 360px and 6 columns from 360px (375, 768 and 1280 keep the live 6 columns). Reason: at 320px each card is about 38.7px wide (under 44px) and "Darjah" is clipped. Alternatives considered: keep 6 columns (broken), 2 columns; 3 chosen as the minimal change (FR-M01-40, §10, URS §7 table).

**Rejected — replicate live:** DV-15 (keyboard-operable role and level cards). **Withdrawn:** DV-09.

Rule D9 (user, 2026-09-25): where the live site is broken or contradictory, fix it; where it works, replicate it exactly. The live defect behind each approved DV is background only.

---

## 1. Scope

**In scope:** every Function FN-M01-1.1.1 … FN-M01-3.3.6 in URS §3. That covers:
- screens S1–S5 and S7–S11;
- the logout action (S6) and the post-login redirect and guards (S12);
- the M01 entries in both shells (bell and badge, account links, identity blocks, logout controls);
- the mock endpoints (§7) and the seed data (§6.8) that make every flow clickable end to end;
- the documented inferred server rules, for the later backend (D5).

**Out of scope:** URS §8. In short: the landing page `/` (a placeholder in the prototype), `/sponsor/register` (M21), notification sending and push (M22), gamification chips (M14), the tournament banner (M16), the chatbot (M22), the view switch and the rest of the shell menus (M23 / global), and real backend concerns.

## 2. Screens & routes

| # | Route | Screen | Primary actor(s) | Access | Shell | Tab title (exact) |
|---|---|---|---|---|---|---|
| S1 | `/login` | Log Masuk | Guest (also renders for logged-in users) | Public | Auth layout | "Log Masuk - PRESTASIPLUS" |
| S2 | `/register` | Daftar | Guest (also renders for logged-in users) | Public | Auth layout | "Daftar - PRESTASIPLUS" |
| S3 | `/password/reset` | Lupa Kata Laluan | Guest | Public | Auth card | "Lupa Kata Laluan - PRESTASIPLUS" |
| S4 | `/password/reset/:token` | Reset Kata Laluan | Guest with link | Public | Auth card | "Reset Kata Laluan - PRESTASIPLUS" |
| S5 | `/password/reset-ic` | Reset Melalui No IC | Guest | Public | Auth card | "Reset Kata Laluan (No IC) - PRESTASIPLUS" |
| S6 | `/logout` | (action) | Authenticated | GET link | — | — |
| S7 | `/profile` | Profil Saya | Authenticated | Auth required | User shell | "Profil Saya - PRESTASIPLUS" |
| S8 | `/profile/edit` | Kemaskini Profil | Authenticated | Auth required | User shell | "Kemaskini Profil - PRESTASIPLUS" |
| S9 | `/tetapan` | Tetapan Peribadi | Authenticated | Auth required | Admin shell (admin, observed); user shell (others, INFERRED, OQ-6; as built for Murid, Guru and Admin Sekolah, still INFERRED) | "Tetapan Peribadi" (no suffix, observed) |
| S10 | `/settings` (and any unknown path) | 404 | All | Public | None | "404 - Halaman Tidak Dijumpai \| PRESTASIPLUS" |
| S11 | `/notifikasi` | Notifikasi | Authenticated | Auth required | User shell | "Notifikasi - PRESTASIPLUS" |
| S12 | (behaviour) | Post-login redirect, guards | All | — | — | — |

Query parameters: S4 `?email=`; S11 `?filter=unread|read`, `?type=system|reminder|milestone`, `?page=n` (pagination keeps `filter`/`type`); S2 ignores `?role=` and `?ref=`.

## 3. Functional requirements

| ID | Requirement | FN | US |
|---|---|---|---|
| FR-M01-01 | S1–S5 SHALL use the standalone auth layout: animated pastel gradient (`coolGradient` 15s), SVG wave, and on S1/S2 the floating emoji 📚 ✏️ ⭐ 🎨 🚀 💡 (visible at every width); a white card with the logo; and the footer "© 2026 PRESTASIPLUS. Platform Pendidikan Malaysia.". S1's card tagline is "Platform Latih Tubi Nasional 🇲🇾" and S2's is "Daftar Akaun Baru 🇲🇾". | 1.1.1–1.1.3 | 02, 06 |
| FR-M01-02 | S1 SHALL show the welcome panel at ≥1024px (DV-07; live ≥768px): 🎓 bubble, H2 "Selamat Kembali! 👋", "Teruskan pembelajaran anda dengan lebih **{questionCount}** soalan latihan dalam **{subjectCount}** subjek berbeza!", and the tiles "🏆 Pencapaian Terbuka / Kumpul lencana dan skor tertinggi", "📈 Jejak Kemajuan / Lihat statistik pembelajaran anda", "🎯 Latihan Tersusun / Dari mudah hingga mencabar". | 1.2.1 | 02 |
| FR-M01-03 | S1 SHALL render: email input (`type=email`, `required`, `autocomplete=email`, placeholder `nama@email.com`, label "Alamat Email" with envelope icon, `@` icon inside) and password input (`required`, `autocomplete=current-password`, placeholder `••••••••`, label "Kata Laluan" with lock icon). | 1.2.2, 1.2.3 | 01 |
| FR-M01-04 | Each password toggle (S1, S2 ×2, S4 ×2) SHALL switch its input between `password` and `text` and its icon between eye and eye-slash (Lucide `Eye`/`EyeOff`). It is `type=button`, so it never submits. The S8 password fields have **no** toggle (as live). | 1.2.4, 1.4.10, 1.4.11, 1.6.4, 1.6.5 | 03, 09, 11 |
| FR-M01-05 | "Ingat saya" (`remember`, unticked by default) SHALL set the session persistence per BR-06. | 1.2.5, 1.3.2 | 03 |
| FR-M01-06 | S1 SHALL show the links "Lupa kata laluan?" → `/password/reset`, "Reset melalui No IC" (id-card icon) → `/password/reset-ic`, "Belum ada akaun? **Daftar Sekarang 🚀**" → `/register` and "Kembali ke Laman Utama" (arrow-left) → `/`. | 1.2.6, 1.2.7, 1.2.12, 1.2.13 | 02 |
| FR-M01-07 | Submitting S1 SHALL set the loading state: the button becomes disabled and shows the spinner + "Sedang Memasuki...". It then calls `POST /api/auth/login`. On success it navigates per FR-M01-12, with no flash or toast. On error it clears the loading state. | 1.2.8 | 01 |
| FR-M01-08 | Every M01 form SHALL rely on **browser-native HTML5 validation** for its `required`/`type=email` attributes (no `novalidate`, no custom client messages), exactly as live. The attributes per field are in §5. | 1.2.9 (and equivalents on S2–S5) | 01, 09, 10 |
| FR-M01-09 | On a credentials failure, S1 SHALL show the alert box above the fields (red-50 background, 2px red-200 border, red-700 text, circle-alert icon) with "Email atau kata laluan tidak sah.", keep the email value and clear the password. | 1.2.10 | 01 |
| FR-M01-10 | (INFERRED) On `RATE_LIMITED`, S1 SHALL show the throttle message (UNVERIFIED COPY, §8) in the same alert box. | 1.2.11 | 01 |
| FR-M01-11 | The S1 stats strip SHALL read "❓ {questionCount}+ Soalan • 📚 {subjectCount} Subjek • 🎓 {levelCount} Tahap", and the welcome text SHALL use the same values. Both come from `GET /api/public/stats`, which derives them at request time (DV-05, D11): `questionCount` = `namedCount('Q-ELIGIBLE')`, the M04 SRS §4.1 named query (status approved ∧ active; 128,989 with the standard dataset); `subjectCount` = number of subjects in M03; `levelCount` = number of education levels in M03 (11). Formatted with `ms-MY` thousands separators ("128,989"). No count is stored or hard-coded in M01. | 1.2.14 | 02 |
| FR-M01-12 | After a successful login the app SHALL navigate to the role landing page (BR-07). It SHALL ignore any previously requested URL and show no message. | 1.3.1 | 04 |
| FR-M01-13 | `/login` and `/register` SHALL render normally for an authenticated user. There is no guest-only guard, redirect or notice. | 1.3.4 | 04 |
| FR-M01-14 | An auth guard SHALL redirect a guest opening any auth-required route (S7, S8, S9, S11 and every non-public route of other modules, e.g. `/dashboard`, `/admin`) to `/login?redirect=<original path>`, with no message (v2: D51, M01-DEV-02; live sends no `redirect` parameter). When a mock endpoint returns `UNAUTHORIZED`, the client SHALL clear the session and go to `/login` the same way (live: 302 → `/login`). | 1.3.3 | 05 |
| FR-M01-15 | S2 SHALL show the welcome panel at ≥1024px (DV-07; hidden below, including its mascot): the mascot bubble 🎒, H2 "Sertai Kami! 🌟", "Daftar sekarang dan mulakan perjalanan pembelajaran yang menyeronokkan!", and the tiles "🎮 Pembelajaran Gamifikasi / Belajar sambil bermain", "👥 Komuniti Aktif / Belajar bersama rakan", "📊 Laporan Terperinci / Pantau prestasi anda". It SHALL also show the static step indicator "1 — 2 — 3", with step 1 styled active and steps 2 and 3 inactive. The indicator is not interactive and never changes. | 1.4.1, 1.4.2 | 06 |
| FR-M01-16 | S2 SHALL render, in order: "Nama Penuh" (`name`, text, required, placeholder `Muhammad Fulan bin Fulan`, DV-17), "Alamat Email" (`email`, email, required, placeholder `nama@email.com`), "No. Telefon (Pilihan)" (`phone`, tel, `maxlength=14`, `inputmode=tel`, placeholder `Cth: 0191234567`). | 1.4.3–1.4.5 | 06 |
| FR-M01-17 | S2 SHALL show "Sudah ada akaun? **Log Masuk 🔑**" → `/login`, "Mewakili organisasi? **Daftar sebagai Penaja**" (handshake icon) → `/sponsor/register`, and "Kembali ke Laman Utama" (home icon) → `/`. | 1.4.13–1.4.15 | 06 |
| FR-M01-18 | S2 SHALL not change for any query parameter: `role` always starts as `student`, and no referral field or hidden input is added (OBSERVED). A `ref` code is only carried in the background per FR-M01-70 (provisional). | 1.4.16 | 06 |
| FR-M01-19 | "Saya adalah..." SHALL offer the 3 cards in §6.7 (Pelajar default). Clicking a card selects it, applies the selected style (indigo border, gradient `#EEF2FF→#E0E7FF`, 3px ring) and sets `role`. The cards are click/tap targets without keyboard semantics, as live (FR-M01-66; DV-15 rejected). | 1.4.6 | 07 |
| FR-M01-20 | When role = student, S2 SHALL show "Pilih Tahap Anda" with the sub-headings displayed in uppercase "SEKOLAH RENDAH" (school icon) and "SEKOLAH MENENGAH" (building icon) (source text "Sekolah Rendah" / "Sekolah Menengah" with CSS `text-transform: uppercase`), 6 "Darjah n" buttons (value n) and 5 "Ting. n" buttons (value n+6), none selected. Clicking a button selects it (gradient style) and sets `grade`. For Guru **and Ibu Bapa** (DV-06) the section is hidden and `grade` is not submitted. The buttons are click/tap only, as live (FR-M01-66). | 1.4.7 | 07 |
| FR-M01-21 | When role = student, S2 SHALL show "No. Kad Pengenalan (Pilihan)" (`ic_number`, text, `maxlength=14`, `inputmode=numeric`, placeholder `Cth: 031215101234`) and the shield hint "Dilindungi PDPA. Hanya 2 digit terakhir akan dipaparkan.". It is hidden for Guru and Ibu Bapa. There is no format validation beyond maxlength (as live). | 1.4.8 | 07 |
| FR-M01-22 | The S2 school picker ("Sekolah (Pilihan)") SHALL behave as follows:<br>• It shows a state select (options in §6.7, register labels) and a search input "Taip nama sekolah...".<br>• Focusing the input opens the dropdown; a click outside closes it.<br>• Input is debounced 300 ms. The search runs when the query has ≥2 characters **or** a state is chosen (choosing a state with an empty query loads that state's schools). It calls `GET /api/schools/search` with `limit=15`.<br>• The dropdown is shown when it is open **and** (there are results **or** the query has ≥2 characters). Each row: NAME (bold, uppercase as stored) and "{type} · {state} · {district}".<br>• Empty state (results = 0, query ≥2, not searching): search icon + "Tiada sekolah dijumpai".<br>• Picking a row hides the select and search and shows the chip: name, then "{type} · {state}", and a clear button (✕) that restores them.<br>• `school_id` = the picked id, or empty. | 1.4.9 | 08 |
| FR-M01-23 | S2 SHALL render "Kata Laluan" (`password`, required, placeholder `••••••••`, toggle `showPassword`) with the info-icon hint "Minimum 6 aksara", and "Sahkan Kata Laluan" (`password_confirmation`, required, placeholder `••••••••`, its own toggle `showPasswordConfirm`). | 1.4.10, 1.4.11 | 09 |
| FR-M01-24 | Submitting S2 SHALL set the loading state (disabled, spinner, "Sedang Mendaftar...") and call `POST /api/auth/register` with `name, email, phone, role, grade (student only), icNumber (student only), schoolId, password, passwordConfirmation`. | 1.4.12 | 09 |
| FR-M01-25 | (INFERRED) On register success the client SHALL store the session (not remembered), navigate to the role landing page (BR-07) and show no message (Laravel default `RegisterController`: log in, then redirect). | 1.4.17 | 09 |
| FR-M01-26 | (INFERRED) On `VALIDATION_ERROR` from register, S2 SHALL clear the loading state, show the errors in the red alert box above the fields (one line per error, UNVERIFIED COPY in §8), keep every entered value except the two passwords, and keep the chosen role, level and school. | 1.4.18 | 09 |
| FR-M01-27 | S3 SHALL render a centred card: 🔑 (60px), H "Lupa Kata Laluan?", "Masukkan email anda dan kami akan hantar pautan untuk reset kata laluan.", "Alamat Email" (`email`, required, `autofocus`, `autocomplete=email`, placeholder `nama@email.com`), and "Kembali ke Log Masuk" (arrow-left) → `/login`. There is no link to S5. | 1.5.1, 1.5.2, 1.5.4 | 10 |
| FR-M01-28 | Submitting S3 SHALL show the loading state (disabled, spinner, "Menghantar...") and call `POST /api/auth/password/email`. | 1.5.3 | 10 |
| FR-M01-29 | (INFERRED, Laravel password broker) On success, S3 SHALL show a green status box above the form with the sent message. On `VALIDATION_ERROR` (unknown email) or `RATE_LIMITED`, it SHALL show the red alert with the matching message (UNVERIFIED COPY). The email value is kept. In the prototype the mock records the issued token in the dev outbox (§7 note). | 1.5.5 | 10 |
| FR-M01-30 | S4 SHALL render: 🔒, H "Reset Kata Laluan", "Masukkan kata laluan baru anda.", hidden `token` (from the path), "Alamat Email" (required, pre-filled from `?email=`, otherwise empty and editable), "Kata Laluan Baru" (required, `autocomplete=new-password`, placeholder "Minimum 6 aksara", toggle), "Sahkan Kata Laluan" (required, `autocomplete=new-password`, placeholder "Taip semula kata laluan", toggle), and "Kembali ke Log Masuk" → `/login`. It renders for any token value. | 1.6.1–1.6.5, 1.6.7 | 11 |
| FR-M01-31 | Submitting S4 SHALL show the loading state (disabled, spinner, "Menukar...") and call `POST /api/auth/password/reset`. | 1.6.6 | 11 |
| FR-M01-32 | (INFERRED, Laravel `ResetsPasswords`) On success the client SHALL store a new session and navigate to the role landing page, passing the status message (UNVERIFIED COPY) as a flash for that page. On an invalid or expired token, or other validation errors, S4 SHALL show the red alert (UNVERIFIED COPY) and keep the email. | 1.6.8 | 11 |
| FR-M01-33 | S5 SHALL render: large indigo id-card icon, H "Reset Melalui No IC", "Masukkan email dan No Kad Pengenalan yang didaftarkan dalam profil anda.", "Alamat Email" (required, autofocus, placeholder `nama@email.com`), "No Kad Pengenalan" (`ic_number`, text, required, `maxlength=14` (DV-04; live 20), placeholder `000101010000`, no inputmode), the hint "Tanpa tanda sempang (-). Contoh: 000101010000", and "Kembali ke Log Masuk" → `/login`. | 1.7.1–1.7.3, 1.7.5 | 12 |
| FR-M01-34 | Submitting S5 SHALL show the loading state (disabled, spinner, "Memproses...") and call `POST /api/auth/password/reset-ic`. | 1.7.4 | 12 |
| FR-M01-35 | (INFERRED, OQ-2) On a match the client SHALL navigate to `/password/reset/{token}?email={email}` (S4, pre-filled) using the returned token. On `VALIDATION_ERROR` it SHALL show the red alert with the mismatch message (UNVERIFIED COPY) and keep the entered values. | 1.7.6 | 12 |
| FR-M01-36 | Logout controls SHALL appear exactly where live has them:<br>• user shell ≥1024px: icon link (sign-out, title "Log Keluar") in the sidebar user block, and the icon link in the header;<br>• user shell <1024px: "Log Keluar" in the drawer account section;<br>• admin shell ≥1024px: sidebar footer icon and header icon;<br>• admin shell <1024px: "Log Keluar" as the last item of the "Lagi" menu.<br>All of them are plain links to `/logout`. | 1.8.1 | 13 |
| FR-M01-37 | The `/logout` route SHALL call `POST /api/auth/logout`, clear the client session whatever the result, and `replace` the history entry with `/login`. It shows no message and no confirmation (live: `GET /logout` → 302 `/login`). | 1.8.2 | 13 |
| FR-M01-38 | S7 SHALL show the shell header "Profil Saya" / "Statistik & Pencapaian Anda" and one hero card (indigo→purple gradient `#667EEA→#764BA2`, rounded-3xl). The card contains:<br>• the avatar image (`avatarUrl`, or the generated initials image, BR-15) with a white ring and an orange crown badge;<br>• the name (Outfit 30px/700, white, DV-14; live slate-800 is unreadable on the gradient);<br>• the email;<br>• calendar icon + "Ahli sejak {d MMMM yyyy}" (`ms-MY` month names);<br>• the pill "Kemaskini Profil" (pen icon) → `/profile/edit`.<br>No other blocks. | 2.1.1–2.1.3 | 14 |
| FR-M01-39 | S8 SHALL show the shell header "Kemaskini Profil" / "Maklumat peribadi & sekolah anda" and the card "Maklumat Peribadi", containing:<br>• "Nama Penuh" (`name`, required, pre-filled);<br>• "Email" (no name, disabled, grey) with "Email tidak boleh diubah";<br>• "No. Telefon" (`phone`, tel, placeholder `012-3456789`);<br>• "Bio / Motto" (`bio`, textarea, `maxlength=500`, placeholder "Tulis sesuatu tentang diri anda...") with a **static** counter text "Baki: 500 aksara". The counter never updates, whether the bio is empty, pre-filled or being typed in (as live, where its `$refs.bioInput` binding is missing). | 2.2.1, 2.2.4–2.2.7 | 16 |
| FR-M01-40 | S8 SHALL show "Tahap" with one level group as radio cards (`grade`, hidden radios, labels as cards), the current level checked and highlighted with the indigo→purple gradient:<br>• grade null or 1–6: sub-heading displayed "SEKOLAH RENDAH" (school icon; source text "Sekolah Rendah", CSS uppercase), Darjah 1–6 in a 6-column grid (3 columns below 360px, DV-19);<br>• grade 7–11: "SEKOLAH MENENGAH" (building icon), Ting. 1–5 (INFERRED, OQ-5).<br>Shown for every role (as live for admin). | 2.2.8 | 16 |
| FR-M01-41 | S8's "Gambar Profil" card SHALL show:<br>• a 96px rounded avatar;<br>• a hover overlay (black 40%, camera icon) that is a label for the hidden file input and opens it;<br>• "Pilih Gambar" (the same label);<br>• the hint "JPG, PNG atau WEBP. Maks 2MB.".<br>Choosing a file SHALL only preview it (FileReader replaces the avatar image) and un-hide the "Simpan" (check icon) submit. Pressing "Simpan" calls `POST /api/me/picture`. (INFERRED) On success the page reloads its data and shows the new avatar everywhere, with the success flash (UNVERIFIED COPY). On `VALIDATION_ERROR` it shows the error in the red alert at the top of main (UNVERIFIED COPY). No client-side type or size check beyond `accept`. | 2.2.2, 2.2.3 | 15 |
| FR-M01-42 | S8's "Maklumat Sekolah" card SHALL show "Pilih sekolah anda untuk sambung dengan rakan sekelas". When a school is set, it shows the green chip: school icon tile, NAME, then "{type}" + ("·" + state if state) + ("·" + district if district), and a clear button (✕ in a circle) that clears the selection and shows FR-M01-43. `school_id` = the selected id, or empty. | 2.2.9 | 17 |
| FR-M01-43 | S8's school search SHALL behave as follows:<br>• It shows a full-width select ("Semua Negeri" + 16 full names, §6.7) and a search input with a magnifier icon, placeholder "Taip nama sekolah (min. 2 huruf)...".<br>• Focusing the input opens the dropdown; a click outside closes it.<br>• Input is debounced 300 ms. The search runs when the query has ≥2 characters or a state is chosen, with `limit=20`.<br>• The dropdown shows when it is open and (results > 0 or query ≥2). Rows have a school icon tile, the NAME in bold uppercase, and "{type} · {state} · {district}".<br>• Empty state (results = 0, query ≥2, not searching): "Tiada sekolah dijumpai" / "Cuba tukar negeri atau kata kunci lain".<br>• No loading indicator while searching. On a request error nothing is shown (console only).<br>• Picking a row sets the chip. | 2.2.10 | 17 |
| FR-M01-44 | S8's actions row SHALL show "Kembali" (arrow-left) → `/profile` and "Simpan Profil" (save icon, `save-gradient`). "Simpan Profil" submits `PUT /api/me` with `name, phone, bio, grade, schoolId`. (INFERRED) On success S8 re-renders with the saved values and the success flash (UNVERIFIED COPY). On `VALIDATION_ERROR` it shows the red alert (UNVERIFIED COPY) and keeps the input. | 2.2.11, 2.2.12 | 16 |
| FR-M01-45 | S8's "Tukar Kata Laluan" card SHALL render:<br>• "Kata Laluan Semasa" (`current_password`, `autocomplete=current-password`);<br>• "Kata Laluan Baharu" (`password`, `autocomplete=new-password`) with the hint "Sekurang-kurangnya 6 aksara" (DV-03; live "…8 aksara");<br>• "Sahkan Kata Laluan Baharu" (`password_confirmation`, `autocomplete=new-password`).<br>There are no `required` attributes and no toggles. "Tukar Kata Laluan" (shield icon, `warn-gradient`) submits `PUT /api/me/password`. (INFERRED) On success the fields are cleared and the success flash shows (UNVERIFIED COPY); the session is kept. On errors the red alert shows (UNVERIFIED COPY). | 2.2.13, 2.2.14 | 18 |
| FR-M01-46 | S9 SHALL render, in a centred column (max ≈728px):<br>• the slate-gradient hero "⚙️ Tetapan Peribadi" + "Atur pengalaman PrestasiPlus mengikut keperluan rohani & masa anda.";<br>• the card "🕌 Mod Rohani" (intro text) with 4 checkbox rows, each with a bold label and a description (§8), value `1`: `spiritual_mode`, `show_bismillah_splash`, `subuh_push_enabled` + `subuh_push_time` (type time), `ramadan_mode_enabled` + `sahur_push_time` (type time);<br>• the card "🌍 Latar Agama (opsyen)" (intro) with the `faith` select and its description.<br>The controls are fully independent: no show/hide, enable or disable logic (as live). Values come from `GET /api/me/settings` (defaults BR-17). | 2.3.1–2.3.7 | 19 |
| FR-M01-47 | For admin, S9 SHALL render inside the admin panel shell, whose header shows "Tetapan Peribadi" with no subtitle (DV-13; live wrongly shows "Dashboard" / "Selamat datang, Admin"). This implements the shell rule `docs/design/shells.md` DV-SH-03 (title derived from the route; no subtitle unless live shows a correct one) and DV-SH-07. For other roles it renders inside the user shell with the same header (INFERRED, OQ-6). | 2.3.8 | 19 |
| FR-M01-48 | "💾 Simpan Tetapan" (teal→cyan gradient; the 💾 is an emoji) SHALL submit `PUT /api/me/settings` with every field (an unticked checkbox = `false`). (INFERRED) On success S9 re-renders with the saved values and the success flash (UNVERIFIED COPY). | 2.3.9 | 19 |
| FR-M01-49 | The user-shell drawer (<1024px) SHALL keep its "Tetapan" item (cog icon) in the account section next to "Profil Saya" and "Log Keluar", linking to `/tetapan` (DV-01; live `/settings`). | 2.4.1 | 21 |
| FR-M01-50 | Any unknown route, including `/settings`, SHALL render the standalone 404 page:<br>• full-screen gradient blue-900 → violet-600 → pink-500;<br>• a large translucent "404", 🔍, H1 "Halaman Tidak Dijumpai", and "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?";<br>• the pills "Halaman Utama" → `/` and "Mula Latihan" → `/practice` (DV-02; live `/latih-tubi`);<br>• the caption "PRESTASIPLUS";<br>• the system font; the tab title per §2. | 2.4.2, 2.4.3 | 21 |
| FR-M01-51 | Shell account links SHALL be present:<br>• user sidebar (≥1024px): "Tetapan Peribadi" (cog) → `/tetapan` and "Profil Saya" (user-circle) → `/profile`;<br>• user drawer (<1024px): "Tetapan Peribadi" → `/tetapan` and "Profil Saya" → `/profile`;<br>• admin sidebar (≥1024px): "Tetapan Peribadi" → `/tetapan`.<br>They sit in the menu positions given by the global shell spec. | 2.5.1 | 20 |
| FR-M01-52 | Shell identity blocks SHALL show the current user from `GET /api/me`:<br>• user sidebar card: avatar (alt "Avatar"), name, email;<br>• user header avatar (≥1024px);<br>• drawer user card: avatar, name, lowercase role code (`role` value, e.g. "admin");<br>• admin sidebar card: avatar, name, role label ("Admin");<br>• admin header avatar (≥1024px). | 2.5.2 | 20 |
| FR-M01-53 | The user-shell header SHALL show the bell link (bell icon, title "Notifikasi") → `/notifikasi` at every width. It carries a red badge with the unread count ("99+" when > 99). The badge is hidden when the count is 0 (OBSERVED, page script). The badge is rendered with the page, then refreshed by `updateNotifBadge()` from `GET /api/me/notifications/unread-count`:<br>• on page load;<br>• every 60 s while the page is open (`setInterval(…, 60000)`);<br>• whenever a foreground push message arrives (the push channel is owned by M22; the prototype simulates it with `mock.pushNotification()`, §7).<br>The refresh updates only the badge, with no page reload. (OBSERVED, page script) | 3.1.1 | 22 |
| FR-M01-54 | S11 SHALL show the shell header "Notifikasi" / "Peti masuk mesej anda", a centred column (max-w 2xl ≈640px), and the title row "Peti Masuk" + a red pill with `meta.counts.unread` (hidden when 0, INFERRED, URS OQ-7). | 3.2.1, 3.2.2 | 23 |
| FR-M01-55 | S11 SHALL show the filter strip as router links:<br>• "Semua ({counts.all})" → `/notifikasi`;<br>• "Belum Dibaca ({counts.unread})" → `?filter=unread`;<br>• "Sudah Dibaca" → `?filter=read`;<br>• a "\|" divider;<br>• "Sistem" (cog) → `?type=system`, "Peringatan" (clock) → `?type=reminder`, "Pencapaian" (trophy) → `?type=milestone`.<br>Each link sets only its own parameter. Active pill style: indigo-600 background, white, bold. Inactive: gray-100 / gray-600. The category pills have blue/amber/green tints when inactive. The active status pill is highlighted, and when a category filter is active, that category pill uses the active style (DV-12; live highlights no pill). | 3.2.5, 3.2.6 | 23 |
| FR-M01-56 | Each notification item (hidden when its id is in the client's `deletedIds`) SHALL show:<br>• a white rounded-xl bordered card;<br>• a round indigo-100 icon with a bell;<br>• the title (14px semibold) and body (14px gray-600);<br>• the meta line: clock icon + relative time (BR-20) + a small badge with `type` in uppercase (CSS `uppercase` of the stored lowercase code).<br>Unread items (`readAt = null`) have an indigo-200 border, an indigo-50/30 background, a bold indigo title and an indigo dot on the right. Items are ordered newest first, 20 per page. | 3.2.7 | 23 |
| FR-M01-57 | S11 pagination (Laravel Tailwind paginator, reproduced):<br>• ≥640px: the text "Showing **{from}** to **{to}** of **{total}** results", then a button group: chevron-left (aria "&laquo; Previous"; disabled span on page 1), page links (current page as a non-link span; aria "Go to page n"), chevron-right (aria "Next &raquo;"; disabled span on the last page). All pages are listed when lastPage ≤ 13; otherwise Laravel's window of 3 pages each side with "..." separators.<br>• <640px: "« Previous" and "Next »" only, as links, or as disabled text at the bounds.<br>• All links keep the current `filter`/`type` query.<br>Shown only when total > 20. | 3.2.10, 3.2.11 | 23 |
| FR-M01-58 | When the current list is empty, S11 SHALL show the slashed-bell icon, "Tiada notifikasi" and "Notifikasi baru akan muncul di sini", hide "Pilih", and still show "Tanda semua dibaca". | 3.2.12 | 23 |
| FR-M01-59 | Outside select mode, clicking an item's body SHALL call `POST /api/me/notifications/:id/read` and then restyle the item as read (remove the unread border, tint, bold and dot). There is no navigation (the item has no link). The S11 "Peti Masuk" pill and the filter counts are not changed until the next page load (no update code on the item). The header badge refreshes at its next refresh (≤60 s, or on push) per FR-M01-53. | 3.2.8 | 24 |
| FR-M01-60 | "Tanda semua dibaca" (double-check icon; hidden in select mode) SHALL call `POST /api/me/notifications/read-all` and then reload the list and counts (live: form POST + redirect back). No message (INFERRED). | 3.2.3 | 24 |
| FR-M01-61 | Each item's delete button (bin icon, rounded, tooltip `title="Padam"`) SHALL be hidden in select mode. On hover-capable devices it has opacity 0 and becomes visible while the pointer is over it (as live). On devices without hover (`@media (hover: none)`), and on keyboard focus, it is always visible (DV-11). It SHALL `window.confirm('Padam notifikasi ini?')`. On OK it calls `DELETE /api/me/notifications/:id`, adds the id to `deletedIds` (item hidden at once), then reloads the list and counts. | 3.2.9 | 24 |
| FR-M01-62 | "Pilih" (check-circle icon; shown only when the list is non-empty and not in select mode) SHALL enter select mode, which:<br>• hides "Tanda semua dibaca", "Pilih" and the item delete buttons;<br>• shows the "Pilih Semua" checkbox + label and "Batal";<br>• shows a checkbox on each item;<br>• disables item-click mark-read.<br>"Pilih Semua" toggles every item id on the current page. With ≥1 selected, it shows "{n} dipilih". "Batal" exits select mode, clears the selection and unticks "Pilih Semua". | 3.2.4, 3.3.1, 3.3.2, 3.3.3, 3.3.6 | 25 |
| FR-M01-63 | "Tanda Dibaca" (check icon; shown when ≥1 is selected) SHALL call `POST /api/me/notifications/bulk-read {ids}`, then reload the list and counts, and exit select mode (INFERRED). | 3.3.4 | 25 |
| FR-M01-64 | "Padam" (bin icon; shown when ≥1 is selected) SHALL `window.confirm('Padam {n} notifikasi yang dipilih?')`. On OK it calls `POST /api/me/notifications/bulk-delete {ids}`, then reloads the list and counts, and exits select mode (INFERRED). | 3.3.5 | 25 |
| FR-M01-65 | Every M01 screen SHALL follow the responsive behaviour in §10 (live layout adapted to Tailwind breakpoints, plus DV-07, DV-08, DV-10 and DV-11) and NFR-RESP-01..10. No M01 content text SHALL render below 12px (DV-16, master NFR-02): live text that is smaller keeps its weight and colour and is raised to 12px. | all screen FNs | 26 |
| FR-M01-66 | The register role cards and grade buttons SHALL be operable by click/tap only, with no keyboard or ARIA semantics, as live (DV-15 rejected). | 1.4.6, 1.4.7 | 26 |
| FR-M01-67 | Browser tab titles SHALL match §2 exactly. | all screen FNs | 02, 06, 10, 11, 12, 14, 16, 19, 21, 23 |
| FR-M01-68 | (INFERRED) When `POST /api/auth/login` returns `FORBIDDEN` with code `ACCOUNT_INACTIVE` (BR-23), S1 SHALL clear the loading state and show the red alert with "Akaun anda tidak aktif. Sila hubungi pentadbir." (UNVERIFIED COPY, shared with M02). It keeps the email, clears the password, and creates no session. | 1.2.15 | 01 |
| FR-M01-69 | (INFERRED; M14 XR-M14-02) After every successful **password** login (`POST /api/auth/login` 200, and the auto-login of registration and password reset), the mock auth service SHALL call `gamification.onLogin(userId, at)` once, with `at` = the mock-clock time also written to `lastLoginAt` (BR-25). The M14 contract applies BR-M14-14 (streak; +2 `daily_login` on a student's first password login of the day). The test-only fast login `setUser` does NOT call it. A failure inside the hook does not block the login. | 1.2.8 | 01 |
| FR-M01-70 | (Provisional, INFERRED; M14 XR-M14-02) On load of `/register?ref={code}`, S2 SHALL keep `code` in sessionStorage `pp.pendingRef` (in memory when storage is unavailable) and send it as `referralCode` in `POST /api/auth/register`. After creating the user, the mock SHALL call `referrals.onRegistered(newUserId, referralCode)` (M14 BR-M14-19), then clear `pp.pendingRef`. The form stays as live: no field, no hidden input, Pelajar preselected (FR-M01-18). An unknown code is ignored silently. | 1.4.16 | 06 |

### 3.1 Traceability (US → FR → E2E)

| US | FR | E2E |
|---|---|---|
| US-M01-01 | 03, 07, 08, 09, 10, 68, 69 | 02, 03, 05, 06, 50, 51 |
| US-M01-02 | 01, 02, 06, 11, 67 | 01, 47 |
| US-M01-03 | 04, 05 | 07, 08 |
| US-M01-04 | 12, 13 | 03, 04, 09, 10 |
| US-M01-05 | 14 | 09, 11 |
| US-M01-06 | 01, 15, 16, 17, 18, 67, 70 | 12, 13 |
| US-M01-07 | 19, 20, 21 | 14 |
| US-M01-08 | 22 | 15 |
| US-M01-09 | 04, 08, 23, 24, 25, 26 | 16, 17, 18 |
| US-M01-10 | 08, 27, 28, 29, 67 | 19, 20 |
| US-M01-11 | 04, 30, 31, 32, 67 | 21, 22 |
| US-M01-12 | 33, 34, 35, 67 | 23, 24 |
| US-M01-13 | 36, 37 | 25 |
| US-M01-14 | 38, 67 | 26 |
| US-M01-15 | 41 | 27 |
| US-M01-16 | 39, 40, 44, 67 | 28, 29 |
| US-M01-17 | 42, 43 | 30 |
| US-M01-18 | 45 | 31 |
| US-M01-19 | 46, 47, 48, 67 | 32, 33, 34 |
| US-M01-20 | 51, 52 | 35 |
| US-M01-21 | 49, 50, 67 | 36 |
| US-M01-22 | 53 | 37, 49 |
| US-M01-23 | 54, 55, 56, 57, 58, 67 | 38, 39, 40 |
| US-M01-24 | 59, 60, 61 | 41, 42, 43 |
| US-M01-25 | 62, 63, 64 | 44, 45, 46 |
| US-M01-26 | 65, 66 | 47, 48 |

Every FN (110) is specified by ≥1 FR (column "FN" above). Every FR is verified by ≥1 E2E scenario (§12).

## 4. Business rules

| # | Rule | Source |
|---|---|---|
| BR-01 | Login is by email + password. A credentials failure returns the single message "Email atau kata laluan tidak sah." for both an unknown email and a wrong password. | OBSERVED |
| BR-02 | Login throttle: 5 failed attempts per email + IP in 60 s → locked until the window passes. | INFERRED (Laravel `ThrottlesLogins` default) |
| BR-03 | Password minimum 6 characters everywhere (register, token reset, change password), and confirmation required. No composition rules, no maximum beyond the field length (255). | OBSERVED (6 on register/reset) + DV-03 |
| BR-04 | Self-registration: `role ∈ {student, teacher, parent}` (default student); `name` required (≤255); `email` required, valid, unique; `phone` optional (≤14); `grade` 1–11 required when role = student, and ignored otherwise; `ic_number` optional, student only, ≤14 (DV-04), stored for the IC reset, and per the hint only its last 2 digits may ever be displayed; `school_id` optional and must exist. | OBSERVED (form) / INFERRED (server) |
| BR-05 | Registration logs the new user in immediately and redirects to the landing page. There is no email verification (`/email/verify` is a 404). | INFERRED / OBSERVED (404) |
| BR-06 | Session: without "Ingat saya", the session and XSRF cookies expire 120 min (2 h) after the last response (OBSERVED cookie expiry, i.e. `SESSION_LIFETIME=120`), and no remember cookie is set. The session survives a browser restart within that time. With "Ingat saya", a long-lived remember token keeps the user logged in until logout (INFERRED duration). In the prototype the sliding expiry is refreshed at most once per minute per session (F-11 as-built). | OBSERVED / INFERRED |
| BR-07 | Landing page after login or register: `admin` → `/admin` (observed); `ppd_officer` → `/ppd/dashboard`; `jpn_officer` → `/jpn/dashboard`; `student`, `teacher`, `parent`, `sponsor`, `school_admin` → `/dashboard` (INFERRED, URS OQ-3; M02 records no landing pages). | OBSERVED / INFERRED |
| BR-08 | Live ignores the previously requested URL after login. **v2 (D51, M01-DEV-02):** the previously requested path (the `redirect` query set by FR-M01-14) is used after a successful login only if it is same-origin, not an auth page and allowed for the user's role; otherwise the user lands on the role landing page (BR-07). Unsafe values (`//x`, `https://…`, `/\`, `javascript:`) fall back to the landing page. Guest pages have no guest-only guard. | OBSERVED (live) / v2 deviation |
| BR-09 | Every account route requires authentication. A guest is redirected to `/login` without a message. Account JSON endpoints called by a guest also end on `/login` (live 302). | OBSERVED |
| BR-10 | Forgot password (Laravel broker): a token valid 60 min, single use; a new request for the same email within 60 s is throttled; an unknown email returns an error (the live Laravel default reveals whether the email exists). | INFERRED |
| BR-11 | Token reset: the form accepts any token in the URL. On submit the token must match the email and be unexpired. On success the password is updated, the token is deleted, the user is logged in and redirected to the landing page. | INFERRED (Laravel `ResetsPasswords`) |
| BR-12 | IC reset: succeeds only when a user has that email **and** a stored `ic_number` equal to the input (compared as entered, after trimming; in the prototype by comparing the salted SHA-256 hash, §6.1). It then issues a broker token and continues on S4. Accounts without an IC can never succeed. | INFERRED (OQ-2) |
| BR-13 | Email cannot be changed by the user. | OBSERVED ("Email tidak boleh diubah") |
| BR-14 | Profile update: `name` required (≤255); `phone` optional; `bio` ≤500; `grade` 1–11 or null; `school_id` null or existing. | OBSERVED (attrs) / INFERRED (server) |
| BR-15 | Profile picture: JPEG/PNG/WEBP, ≤2 MB. Without a picture the avatar is a generated initials image: name initials, white on `#4F46E5` (200px) on `/profile`, and on `#6366F1` (120px) on `/profile/edit` and the shells. | OBSERVED |
| BR-16 | Password change: `current_password` must match; the new password follows BR-03 and must be confirmed. The current session is kept. | INFERRED |
| BR-17 | Settings defaults: every checkbox false, `subuh_push_time` 05:30, `sahur_push_time` 04:30, `faith` null ("— Tidak nyatakan —"). A save always writes all fields; an unticked checkbox is saved as false. | OBSERVED (defaults) / INFERRED |
| BR-18 | `spiritual_mode = false` disables every spiritual touchpoint (splash, Subuh push, Ramadan push) for consumer modules (M05 quiz splash, M22 push), whatever the sub-settings say. M01 only stores the values. | OBSERVED (copy) |
| BR-19 | Notifications: each belongs to one user, is unread while `read_at` is null, and is listed newest first, 20 per page. Counts: "Semua" = all of the user's notifications; "Belum Dibaca" and the unread pill/badge = unread. Status and category filters are applied one at a time (each link sets only its own parameter). Deletion is permanent. | OBSERVED / INFERRED |
| BR-20 | Relative time uses Carbon `diffForHumans()` in the `ms` locale: "{n} saat yang lepas", "{n} minit yang lepas", "{n} jam yang lepas", "{n} hari yang lepas", "{n} minggu yang lepas", "{n} bulan yang lepas", "{n} tahun yang lepas" (largest whole unit). | OBSERVED (jam / minggu / bulan) / INFERRED (other units) |
| BR-21 | The platform statistics are derived, not stored (D11, D12): questions = M04 named query **Q-ELIGIBLE** (M04 SRS §4.1 / BR-M04-20), the same query that feeds the M05 subject cards; subjects and levels = M03 counts. Other screens that show different question figures use other named queries (e.g. M04 S1 "Jumlah" = Q-ALL, M17 "Soalan Aktif" = Q-ACTIVE + Q-PKSK). They are different definitions, not the login stat. | DV-05, D11 |
| BR-22 | The register page's UI ignores the URL query (`role`, `ref`) (OBSERVED). A `ref` code is carried in the background to the register request for M14 referral credit (FR-M01-70; provisional, INFERRED). | OBSERVED / INFERRED |
| BR-23 | An inactive user (`isActive = false`, set by an admin in M02) cannot log in, even with correct credentials. The check runs after the credentials match. The failed attempt does not count toward the throttle (INFERRED). Only the login is refused: the rule does not end an already-open session (INFERRED). | OBSERVED (rule, M02 copy "Pengguna yang tidak aktif tidak boleh log masuk") / INFERRED (mechanics) |
| BR-24 | New-user defaults (ids ≥ 9,000,001: runtime-created users get ids from 9,000,001 upward, in creation order, never reused (owner: M02 SRS §6.15); from registration or M02 creation/import): the user has no notifications (inbox empty state; no badge), default settings (BR-17), an initials avatar, no school unless chosen, and no practice history. For M05/M14/M19 state the user has 0 sessions, 0 coins, 0 points, 0-day streak, level 1 / 0 % mastery, and `trialQuestionsUsed = 0` (the full 50-question trial available), matching the `pelajar2` empty-state seed. These values belong to the owners: M05 (dashboard, sessions, trial), M14 (coins/points/streak), M19 (trial limit). M01 creates no rows in their stores; a missing row reads as these defaults. | INFERRED (from live empty states; new-user view not observed) |
| BR-25 | Every successful login (`POST /api/auth/login` returning 200) SHALL set `User.lastLoginAt` to the current time of the mock clock (the injectable clock used by all mock services; `Asia/Kuala_Lumpur`). A failed, throttled or inactive-account attempt (BR-02, BR-23) does not change it. Registration (BR-05) and a token or IC password reset that logs the user in (BR-11) count as a login and also set it (INFERRED: Laravel fires the same Login event). An M02 "Login As" impersonation does not change the target's value (INFERRED; owner M02). `recordLogin` writes only `lastLoginAt`; it leaves `updatedAt` unchanged (F-11 as-built). | INFERRED (live field implied by M11 "Login Terakhir", OBSERVED there) |
| BR-26 | Login hook: every successful password login triggers the M14 `onLogin(userId, at)` contract exactly once (FR-M01-69). M01 owns no gamification data; M14 owns the streak, coins and `daily_login` rows. | INFERRED (M14 XR-M14-02) |
| BR-27 | A password reset (token reset BR-11 or IC reset BR-12) for an inactive user (`isActive = false`) returns 403 `ACCOUNT_INACTIVE` and changes nothing: the password is unchanged, the token is not consumed, and no session is created. | INFERRED (code review; extends BR-23) |
| BR-28 | An IC-reset token (BR-12) is issued through the same broker as forgot-password, so it also arms the 60 s forgot-password throttle (BR-10) for that email. | INFERRED (code review) |
| BR-29 | A new forgot-password request replaces any earlier (demo) reset token for that email, as the Laravel broker does: only the newest token is valid. | INFERRED (code review; Laravel broker) |
| BR-30 | `PUT /api/me` and the school: for a user whose stored role is `school_admin`, `ppd_officer`, `jpn_officer` or `admin`, a `schoolId` in the body is ignored and the stored `schoolId` is kept (a staff account's school is an admin-assigned tenant scope, M27 BR-M27-19). Only the other roles (`student`, `teacher`, `parent`, …) may change their school here, under BR-14. The role is taken from the stored user of the session, never from the request. The rest of the update (name, phone, bio, grade) is unchanged and the response is a normal 200. | INFERRED (security fix, M27 Part B G4; no live copy) |
| BR-31 | Logout and impersonation: `POST /api/auth/logout` ends the presented session and also every impersonation session opened from it (M27 "Menyamar", XR-M27-21), so a child session cannot outlive the session that started it. The response is 204 as before (SRS #6). | INFERRED (security fix, M27 Part B G4) |

## 5. Validation rules

**Client side: native HTML5 only (as live).** Browser-native messages appear in the browser's own language. There is no custom client copy. The trigger is submit, and the browser blocks submission.

| Form | Field | Native constraints |
|---|---|---|
| S1 login | `email` | `required`, `type=email` |
| S1 login | `password` | `required` |
| S2 register | `name` | `required` |
| S2 register | `email` | `required`, `type=email` |
| S2 register | `phone` | `maxlength=14` (typing is capped) |
| S2 register | `ic_number` | `maxlength=14` (DV-04) |
| S2 register | `password`, `password_confirmation` | `required` |
| S2 register | `grade` (hidden) | `required` while role = student (markup binding). On live, a fallback script also leaves it `required` for Ibu Bapa; with DV-06 it is not required for Ibu Bapa. The browser does not validate hidden inputs, so this is server-enforced in practice |
| S3 | `email` | `required`, `type=email` |
| S4 | `email` | `required`, `type=email` |
| S4 | `password`, `password_confirmation` | `required` |
| S5 | `email` | `required`, `type=email` |
| S5 | `ic_number` | `required`, `maxlength=14` (DV-04) |
| S8 profile | `name` | `required` |
| S8 profile | `bio` | `maxlength=500` |
| S8 picture | `profile_picture` | `accept=image/jpeg,image/png,image/webp` |
| S8 password | all 3 fields | none (server only, as live) |
| S9 | time inputs | `type=time` |

**Server side (mock; INFERRED rules, UNVERIFIED COPY).** Errors are returned as `VALIDATION_ERROR` with `fields`. The UI shows them in the form's red alert box (§8). Message text follows the Laravel 11 English defaults until verified (URS OQ-1).

| Form | Rule | Message (UNVERIFIED COPY) |
|---|---|---|
| Login | credentials | "Email atau kata laluan tidak sah." (OBSERVED) |
| Login | throttle | "Too many login attempts. Please try again in {n} seconds." |
| Login | inactive account | "Akaun anda tidak aktif. Sila hubungi pentadbir." (placeholder, same as M02 §8) |
| Register | name required | "The name field is required." |
| Register | email unique | "The email has already been taken." |
| Register | password min 6 | "The password field must be at least 6 characters." |
| Register | password confirmed | "The password field confirmation does not match." |
| Register | grade required (student) | "The grade field is required." |
| Forgot | unknown email | "We can't find a user with that email address." |
| Forgot | throttle | "Please wait before retrying." |
| Token reset | invalid token | "This password reset token is invalid." |
| Token reset | min / confirmed | as for Register |
| IC reset | no match | "Email atau No Kad Pengenalan tidak sepadan." (placeholder; no Laravel default exists) |
| Profile | name required | "The name field is required." |
| Profile | bio max | "The bio field must not be greater than 500 characters." |
| Picture | image type | "The profile picture field must be a file of type: jpeg, png, webp." |
| Picture | size | "The profile picture field must not be greater than 2048 kilobytes." |
| Change password | current wrong | "The password is incorrect." |
| Change password | min / confirmed | as for Register |

## 6. Data entities & fields

*(solution-architect)* JSON fields are camelCase. IDs follow the SRS.md §7.4 numeric-id exception: User, Notification and School ids are **integers**, as the live site exposes them (`/pelajar/{id}`, `/prestasi/{userId}`, `/headcount/student/{id}`, notification ids, school ids). Reset tokens and session tokens stay opaque strings. The notes give the matching live form field. All mock data lives in an in-memory store seeded from fixtures and reset per E2E test.

### 6.1 DATA-M01-01 — User (base fields; extended and administered in M02 DATA-M02-01)

The User entity is shared with M02. This table holds the base fields that M01 reads and writes. M02 DATA-M02-01 defines the admin-side extensions (`ppdState`, `ppdDistrict`, `subscriptionPackage`, `subscriptionExpiresAt`, `hasPkskSubscription`, `idDelima`, `classLevel`, `isComplimentary`, `createdById`), the `ParentStudentLink` relation (DATA-M02-02) and the admin API shapes (`AdminUserListItem`, `AdminUserDetail`). They are not repeated here. Field names are identical in both documents.

| Field | Type | Required | Notes |
|---|---|---|---|
| id | integer | yes | Live range 1–6,000 is the M02 D11 virtual user dataset (M02 SRS §6.15); canonical accounts 1–11 (§6.8) are anchors in it and are used by other modules (M07 access grants, M08 routes). New users: runtime-created users get ids from 9,000,001 upward, in creation order, never reused (owner: M02 SRS §6.15) |
| name | string ≤255 | yes | `name` |
| email | string ≤255, unique | yes | Immutable by the user (BR-13) |
| password | string | yes | Persisted only as a **salted SHA-256 hash** (F-11 as-built); plaintext is never stored, including for the seed accounts (the demo password is hashed at seed time). **Never returned**. Backend: a slow hash (bcrypt/argon2) |
| phone | string ≤14 \| null | no | `phone` |
| role | enum `student\|teacher\|parent\|sponsor\|school_admin\|ppd_officer\|jpn_officer\|admin` | yes | The 8 codes OBSERVED in M02 (R2). The drawer shows the raw value; labels in §6.7 |
| grade | int 1–11 \| null | student: yes | 1–6 Darjah, 7–11 Tingkatan (M03 codes D1–D6 / T1–T5) |
| icNumber | string ≤14 \| null | no | `ic_number`. **Never returned by M01 (self/non-admin) endpoints**; persisted only in the secrets store as `{icHash, icMasked, salt}` (salted SHA-256; `icMasked` = `xxxxxx-xx-` + last 2 digits, the live mask format); `verifyIc` compares hashes for BR-12. Seeded accounts' full fictitious ICs also sit in the in-memory fixture map that M02 reads through `adminIcNumber` (Q7). The M02 admin endpoints return it in full, as live (`AdminUserDetail`, flagged SEC-M02-07) |
| schoolId | integer \| null | no | → SchoolSummary (M02) |
| bio | string ≤500 \| null | no | |
| avatarUrl | string \| null | no | Prototype: data URL. Null → generated initials image (BR-15) |
| createdAt | datetime | yes | "Ahli sejak". Seed accounts 1–11: 2026-02-06T09:00:00+08:00 (admin date OBSERVED "Ahli sejak 6 Februari 2026", time designed; accounts 2–11 designed) |
| rememberToken | string \| null | no | Backend only |
| isActive | boolean | yes | Default true; set by M02 toggle-active; checked at login (BR-23). Not shown in M01 UI |
| lastLoginAt | datetime \| null | no | Set to the mock clock's "now" on every successful login (BR-25). Null = never logged in. Not shown in M01 UI; read by M02 (user admin) and M11 ("Pernah Login", "Login sahaja", "Belum login", "Login Terakhir"). Returned in `UserMe` and in the owners' admin/report shapes |
| updatedAt | datetime | yes | Maintained on every profile/admin update (M02 shows it); not changed by `recordLogin` (BR-25). Seed accounts 1–11: 2026-02-06T09:00:00+08:00 (designed) |

`UserMe` (API shape) = every field except `password`, `icNumber`, `rememberToken` and `isActive`, plus `school: SchoolSummary | null` and `landingPath` (BR-07).

**Users repository (M01 base) — subscription write (v1.12; M02 BR-12, XR-M19-04, XR-M02-03).** The users repository lists `users.setSubscription(userId, {package, expiresAt})`. It writes `subscriptionPackage` and `subscriptionExpiresAt`; M02 owns both fields (DATA-M02-01) and their rules (M02 BR-12). Callers: the M02 S3 save (M02 API #5) on a package change, which computes the expiry with M19 `billing.computeExpiry`, and M19 payment activation (BR-M19-14). No M01 screen or endpoint calls it, and M01 adds no field.

### 6.2 DATA-M01-02 — ClientSession (prototype)

| Field | Type | Notes |
|---|---|---|
| token | string | Opaque mock token: cryptographically random outside the e2e build; deterministic in e2e (F-11 as-built) |
| remember | boolean | "Ingat saya" |
| expiresAt | datetime | remember: +5 years; otherwise +120 min, sliding on requests, refreshed at most once per minute (BR-06) |
| user | UserMe | Cached for the shell identity blocks |

Stored in `localStorage` key `pp.auth` in both cases (live cookies survive a browser restart in both cases).

### 6.3 DATA-M01-03 — UserSettings (1:1 User)

| Field | Type | Default | Live field |
|---|---|---|---|
| spiritualMode | boolean | false | `spiritual_mode` |
| showBismillahSplash | boolean | false | `show_bismillah_splash` |
| subuhPushEnabled | boolean | false | `subuh_push_enabled` |
| subuhPushTime | string `HH:mm` | "05:30" | `subuh_push_time` |
| ramadanModeEnabled | boolean | false | `ramadan_mode_enabled` |
| sahurPushTime | string `HH:mm` | "04:30" | `sahur_push_time` |
| faith | `muslim\|hindu\|buddhist\|christian\|none` \| null | null | `faith` |

### 6.4 DATA-M01-04 — Notification (shared with M22, which extends it)

| Field | Type | Required | Notes |
|---|---|---|---|
| id | integer | yes | As live (`data-id`, e.g. 180915) |
| userId | integer | yes | Owner → User.id |
| type | string (lowercase code) | yes | e.g. `chatbot_new_conversation`, `spaced_review`, `new_ticket`. Shown uppercased |
| category | `system\|reminder\|milestone` \| null | no | Used by the `?type=` filters (INFERRED; OQ-8). Null = matches no category filter (as the admin's live items) |
| title | string | yes | |
| body | string | yes | |
| readAt | datetime \| null | yes | |
| createdAt | datetime | yes | Sort key |

### 6.5 DATA-M01-05 — PasswordResetToken

| Field | Type | Notes |
|---|---|---|
| email | string | |
| token | string | Opaque |
| createdAt | datetime | Expiry 60 min; throttle 60 s (BR-10) |

### 6.6 DATA-M01-06 — SchoolSummary (reference; entity owned by M02) and DATA-M01-07 — PlatformStats

| SchoolSummary field | Type | Notes |
|---|---|---|
| id | integer | As live (`id:number` in `/api/schools/search`) |
| name | string | Stored and shown uppercase (e.g. "SEKOLAH KEBANGSAAN …") |
| code | string | |
| type | string | Per M02 DATA-M02-03: enum SK, SMK, SJK(C), SJK(T), MRSM, SBP (live data only SK/SMK) |
| state | string | One of the 16 values in §6.7 |
| district | string | e.g. "PPD KLUANG" |
| city | string | |

| PlatformStats field | Type | Notes |
|---|---|---|
| questionCount | int | Derived: `namedCount('Q-ELIGIBLE')` (M04 SRS §4.1; 128,989 with the standard dataset, the DV-05 value) |
| subjectCount | int | Derived: M03 subject count |
| levelCount | int | Derived: M03 education-level count (11) |

### 6.7 DATA-M01-08 — Lookups (static constants)

| Lookup | Values |
|---|---|
| Role cards (S2) | 👨‍🎓 "Pelajar" / "Saya ingin belajar" (`student`, default) · 👨‍🏫 "Guru" / "Saya ingin mengajar" (`teacher`) · 👨‍👩‍👧 "Ibu Bapa" / "Pantau anak saya" (`parent`) |
| Role labels (OBSERVED in M02) | `student` "Pelajar", `teacher` "Guru", `parent` "Ibu Bapa", `sponsor` "Penaja", `school_admin` "Admin Sekolah", `ppd_officer` "Pegawai PPD", `jpn_officer` shown raw (no label on live; "Pegawai JPN" only in the M02 create form), `admin` "Admin". The M01 admin-shell sidebar card shows the label; the user-shell drawer card shows the raw code |
| Grades | 1–6 "Darjah n"; 7–11 "Ting. n−6" |
| States — register select (value → label) | "" → "Negeri", Johor, Kedah, Kelantan, Kuala Lumpur → "KL", Labuan, Melaka, Negeri Sembilan → "N.Sembilan", Pahang, Perak, Perlis, Pulau Pinang → "P.Pinang", Putrajaya, Sabah, Sarawak, Selangor, Terengganu |
| States — profile select | "" → "Semua Negeri", then the same 16 values with full-name labels |
| Faith | "" "— Tidak nyatakan —", muslim "Islam", hindu "Hindu", buddhist "Buddha", christian "Kristian", none "Tiada" |

### 6.8 Seed data (placeholder accounts only; all values fictitious)

The demo password for every account is `Demo1234` (≥6). It lives in the fixture/E2E config, and may also be documented in `README.md` for stakeholder demos (Delivery Lead decision, 2026-09-26). It is fictitious and demo-only; real credentials are never stored.

| id | Email | Role | Name | Grade | IC | School | Notifications | Purpose |
|---|---|---|---|---|---|---|---|---|
| 1 | admin@demo.test | admin | Admin Demo | 4 (Darjah 4) — OBSERVED: /profile/edit `grade` radio 4 checked, S7 "KSSR … Darjah 4". The "Darjah 6" chip on /pelajar/1 is a separate public-profile field owned by M08 (`profileLevelId`), not this grade | — | 900002 SK Demo (Johor) | 167 (166 unread), categories null, types `chatbot_new_conversation`, `new_ticket`, `spaced_review` | Mirrors the live admin: `/admin` landing, 9 pages, "99+", type filters empty |
| 2 | pelajar@demo.test | student | Pelajar Demo | 10 (Ting. 4) | `100101140001` | 900001 SMK DEMO (Selangor, `BEA4001`) | 45 (12 unread; all 3 categories; `spaced_review` etc.) | Main student; IC reset; Menengah Tahap group |
| 3 | pelajar2@demo.test | student | Pelajar Dua Demo | 5 | — | — | 3 (0 unread) | No IC → IC reset fails; empty unread filter |
| 4 | pelajarmaju@demo.test | student | Pelajar Maju Demo | 1 (Darjah 1) | — | 900004 SK Demo Bestari (SK, Johor; fixture school, M02 v1.16) | 5 (2 unread) | Primary student used by M03/M05/M08 (MATH D1 data); M01 uses it for login and landing |
| 5 | guru@demo.test | teacher | Guru Demo | — | — | 900001 SMK DEMO (Selangor, `BEA4001`) | 5 | Teacher landing; secondary school because M02/M08/M10 give this teacher Tingkatan 4/5 classes (XL-26) |
| 6 | ibubapa@demo.test | parent | Ibu Bapa Demo | — | — | — | 0 | Empty inbox |
| 7 | penaja@demo.test | sponsor | Penaja Demo | — | — | — | 1 | Landing `/dashboard` (INFERRED) |
| 8 | adminsekolah@demo.test | school_admin | Pentadbir Sekolah Demo | — | — | 900001 SMK DEMO (Selangor, `BEA4001`) | 1 | School admin of the coded SMK (M02 §6.14, no S16 package); landing `/dashboard` (INFERRED) |
| 9 | ppd@demo.test | ppd_officer | Pegawai PPD Demo | — | — | — | 1 | Landing `/ppd/dashboard` (INFERRED) |
| 10 | jpn@demo.test | jpn_officer | Pegawai JPN Demo | — | — | — | 1 | Landing `/jpn/dashboard` (INFERRED) |
| 11 | tidakaktif@demo.test | student | Pelajar Tidak Aktif Demo | 7 | — | 9167 SEKOLAH MENENGAH KEBANGSAAN GHAFAR BABA (Melaka; placed by M02 v1.23 §6.15 D, XR-M02-03; no class, no answers) | 0 | `isActive = false`: login refused (BR-23) |

These ids are fixed and stable across modules: add new accounts with the next free integer and never renumber. id 1 = admin matches live (`/pelajar/1`, M08 discovery). Users form the M02 D11 virtual dataset (ids 1–6,000; canonical 1–11 and M02 fixtures 5001–5999 are anchors). New users (registration here, creation/import in M02): runtime-created users get ids from 9,000,001 upward, in creation order, never reused (owner: M02 SRS §6.15).

**`lastLoginAt` seed values (canonical accounts; designed, no live observation except where marked).** Consistent with the M08/M11 anchors (fixture "now" = 2026-09-25):

| id | lastLoginAt | Basis |
|---|---|---|
| 1 admin | 2026-09-25T09:00:00+08:00 | OBSERVED that the account logged in on 2026-09-25 (discovery and audit sessions); time designed |
| 2 pelajar | 2026-09-24T20:15:00+08:00 | Designed; recent student activity (M05/M07 seeds) |
| 3 pelajar2 | 2026-09-20T19:30:00+08:00 | Designed; has logged in but has no practice (empty-state student) |
| 4 pelajarmaju | 2026-09-24T18:00:00+08:00 | Designed; M05/M08 D1 sessions |
| 5 guru | 2026-09-24T21:00:00+08:00 | Designed; teacher of M08/M11 classes 2001/2002 (last class activity 09-24), so M11 counts the teacher as "Pernah Login" |
| 6 ibubapa | 2026-09-10T21:00:00+08:00 | Designed |
| 7 penaja | null | Designed; never logged in |
| 8 adminsekolah | 2026-09-20T10:00:00+08:00 | Designed |
| 9 ppd | 2026-09-19T09:30:00+08:00 | Designed |
| 10 jpn | 2026-09-19T10:00:00+08:00 | Designed |
| 11 tidakaktif | null | Inactive; never logged in (BR-23) |

Fixture users outside 1–11 (e.g. M08/M11 students 3001–3008 with the dates of M11 §6.8, and the generated users) get their values from the M02 users dataset (M02 SRS §6.15; XL2-07 co-owner).

**Canonical schools used by these accounts.** Both are fixture records of the M02-owned school dataset (M02 DATA-M02-03, §6.14–6.15; D12):
- **900002 SK Demo (Johor)**: type SK, district "PPD KLUANG", used by id 1 (admin). With no pupils there, M08 S9 shows the observed 0 / "Tiada Data Pelajar".
- **900004 SK Demo Bestari**: fictitious SK fixture school in Johor (M02 v1.16), used by id 4 (pelajarmaju). The admin stays at 900002, which keeps 0 pupils (M08 S9 observed "Tiada Data Pelajar"). A real school (M02 v1.15) was rejected in XL3 round 2 (R2-01) because it would change M17's observed values. Delivery Lead decision, 2026-09-27.
- **900001 SMK DEMO (Selangor)**: type SMK, code `BEA4001` (coded, so school-admin generation works), district "PPD PETALING UTAMA", used by ids 2, 5 and 8. This is the "coded SMK" of M02 §6.14 (XL-15) and the secondary school of the id 5 teacher (XL-26).

- **Schools:** M01 seeds none. Every school (search results, chips, the canonical 900001/900002/900004) comes from the M02 schools dataset (D11 virtual dataset: 10,220 schools in the live id range, fixtures 900001–900099, runtime ids ≥ 10,301; M02 SRS §6.15). That dataset covers what the M01 tests need: ≥20 results for one state (profile limit), district values such as "PPD SEGAMAT" / "JPN PERLIS", and no match for "zzz".
- **Stats:** none in the M01 fixture. `PlatformStats` is computed from M04 Q-ELIGIBLE (128,989 with the standard dataset) and the M03 subject/level fixtures (31 / 11).
- **Reset tokens:** `demo-reset-token` (pelajar@demo.test, valid), `demo-expired-token` (expired).
- **Notification templates:**
  - "Chatbot: Perbualan Baru" / "{nama} memulakan perbualan dari {laluan}";
  - "📚 Nota menunggu kamu, {nama}" / "Hai {nama}! Cikgu Alesa ada 9 nota ringkas tunggu kamu ulangkaji ({subjek}). Klik buka — 5 minit sahaja.";
  - "Tiket baru" (`new_ticket`, placeholder text).
  - `createdAt` values are spread over 90 days.

## 7. Mock API endpoints

*(solution-architect)* Base `/api`, with the envelope, error and locale conventions of SRS.md §7. Authentication is a Bearer mock token. **A** = auth required (else `401 UNAUTHORIZED` → the client goes to `/login`, FR-M01-14). **G** = public. Every call has the configurable mock latency (NFR-M01-02). Throttling uses `429` with code `RATE_LIMITED` and `error.retryAfter` (not yet in the master code list; see §13 Q2).

| # | Method | Path | Auth | Mut. | Request | Success | Errors | Live equivalent |
|---|---|---|---|---|---|---|---|---|
| 1 | POST | `/api/auth/login` | G | yes | `{email, password, remember}` | 200 `{data:{token, expiresAt, user: UserMe}}`; sets `user.lastLoginAt` = mock-clock now (BR-25) | 422 `VALIDATION_ERROR` message "Email atau kata laluan tidak sah."; 403 `FORBIDDEN` code `ACCOUNT_INACTIVE` (BR-23); 429 | `POST /login` |
| 2 | POST | `/api/auth/register` | G | yes | `{name, email, phone?, role, grade?, icNumber?, schoolId?, password, passwordConfirmation}` | 201 `{data:{token, expiresAt, user}}` | 422 `fields` | `POST /register` |
| 3 | POST | `/api/auth/password/email` | G | yes | `{email}` | 200 `{data:{status}}` | 422 (unknown email); 429 | `POST /password/email` |
| 4 | POST | `/api/auth/password/reset` | G | yes | `{token, email, password, passwordConfirmation}` | 200 `{data:{token, expiresAt, user, status}}` (auto-login) | 422 `fields` (incl. `email` for an invalid token) | `POST /password/reset` |
| 5 | POST | `/api/auth/password/reset-ic` | G | yes | `{email, icNumber}` | 200 `{data:{token, email}}` → client goes to S4 | 422 (no match) | `POST /password/reset-ic` |
| 6 | POST | `/api/auth/logout` | A | yes | — | 204; also ends impersonation child sessions of this session (BR-31) | 401 (ignored) | `GET /logout` |
| 7 | GET | `/api/me` | A | no | — | 200 `{data: UserMe}` | 401 | server-rendered |
| 8 | PUT | `/api/me` | A | yes | `{name, phone, bio, grade, schoolId}` (`schoolId` ignored for `school_admin`, `ppd_officer`, `jpn_officer`, `admin`, BR-30) | 200 `{data: UserMe, status}` | 422; 401 | `PUT /profile` |
| 9 | POST | `/api/me/picture` | A | yes | multipart `profilePicture` | 200 `{data:{avatarUrl}, status}` | 422; 401 | `POST /profile/picture` |
| 10 | PUT | `/api/me/password` | A | yes | `{currentPassword, password, passwordConfirmation}` | 200 `{data:{status}}` | 422; 401 | `POST /profile/password` |
| 11 | GET | `/api/me/settings` | A | no | — | 200 `{data: UserSettings}` | 401 | server-rendered |
| 12 | PUT | `/api/me/settings` | A | yes | `UserSettings` | 200 `{data: UserSettings, status}` | 422; 401 | `PUT /tetapan` |
| 13 | GET | `/api/me/notifications` | A | no | `?filter=unread\|read&type=system\|reminder\|milestone&page=n` (pageSize 20) | 200 envelope `{data: Notification[], meta:{page, pageSize, totalItems, totalPages, from, to, counts:{all, unread}}}` | 401 | `GET /notifikasi` |
| 14 | GET | `/api/me/notifications/unread-count` | A | no | — | 200 `{data:{count}}` | 401 | `GET /notifikasi/unread-count` → `{count}` |
| 15 | POST | `/api/me/notifications/read-all` | A | yes | — | 200 `{data:{updated}}` | 401 | `POST /notifikasi/read-all` |
| 16 | POST | `/api/me/notifications/:id/read` | A | yes | — | 200 `{data:{success:true}}` | 404; 401 | `POST /notifikasi/{id}/read` |
| 17 | POST | `/api/me/notifications/bulk-read` | A | yes | `{ids: number[]}` | 200 `{data:{success:true}}` | 422; 401 | `POST /notifikasi/bulk-read` |
| 18 | DELETE | `/api/me/notifications/:id` | A | yes | — | 200 `{data:{success:true}}` | 404; 401 | `DELETE /notifikasi/{id}` |
| 19 | POST | `/api/me/notifications/bulk-delete` | A | yes | `{ids: number[]}` | 200 `{data:{success:true}}` | 422; 401 | `POST /notifikasi/bulk-delete` |
| 20 | GET | `/api/schools/search` | G | no | `?q=&state=&limit=&id=`: `q` = name or code substring; `limit` defaults to 20 when omitted, with no enforced maximum (OBSERVED, M02 audit); `id` returns that school (OBSERVED). M01 screens send `limit=15` (S2) and `limit=20` (S8) | 200 `{data: SchoolSummary[]}` (not paginated; active schools only, M02 R11) | — | `GET /api/schools/search` (observed, public). **Owner: M02**, [srs/M02-users-schools.md](M02-users-schools.md); M01 is a consumer |
| 21 | GET | `/api/public/stats` | G | no | — | 200 `{data: PlatformStats}` (computed per request from the M04 and M03 stores, D11/D12) | 500 | server-rendered login numbers (DV-05) |

Notes:
- `status` fields carry the flash text in §8 (UNVERIFIED COPY).
- `meta.from`/`to` feed the "Showing … results" text. `meta.counts` is an optional extension of the master envelope (§13 Q2).
- Mock-only helpers for dev/E2E builds (not part of the future REST contract): `mock.reset()`, `mock.setLatency(ms)`, `mock.failNext(path, code)`, `mock.expireSession()`, `mock.pushNotification(userId, notification)` (creates a notification and emits the simulated foreground-push event that triggers the badge refresh), `mockOutbox.lastResetFor(email)`.

## 8. States & messages

**Observed copy (exact).**

| Screen | State | Copy |
|---|---|---|
| S1 | Loading | spinner + "Sedang Memasuki..." (button disabled) |
| S1 | Credentials error | "Email atau kata laluan tidak sah." |
| S2 | Loading | spinner + "Sedang Mendaftar..." |
| S2 | School empty | "Tiada sekolah dijumpai" |
| S2 | PDPA hint | "Dilindungi PDPA. Hanya 2 digit terakhir akan dipaparkan." |
| S2 | Password hint | "Minimum 6 aksara" |
| S3 | Loading | spinner + "Menghantar..." |
| S4 | Loading | spinner + "Menukar..." |
| S5 | Loading | spinner + "Memproses..." |
| S5 | Hint | "Tanpa tanda sempang (-). Contoh: 000101010000" |
| S8 | Picture hint | "JPG, PNG atau WEBP. Maks 2MB." |
| S8 | Email hint | "Email tidak boleh diubah" |
| S8 | Bio counter | "Baki: 500 aksara" (static; never changes, as live) |
| S8 | Password hint | "Sekurang-kurangnya 6 aksara" (DV-03; live "Sekurang-kurangnya 8 aksara") |
| S8 | School empty | "Tiada sekolah dijumpai" / "Cuba tukar negeri atau kata kunci lain" |
| S8 | School searching / error | (nothing shown, as live) |
| S9 | Descriptions | "Master toggle — kalau off, semua spiritual touchpoints disable." · "Splash 2-saat sebelum mula quiz: "Bismillahi tawakkaltu 'alallah". Tetapan untuk Muslim." · "Push notifikasi pagi awal untuk yang bangun Subuh — 30 minit study window selepas Subuh = paling produktif." · "Push waktu sahur (~4:30am) untuk study sebelum Subuh. Pace lebih ringan waktu Ramadan." · "Untuk mod rohani yang sesuai. Future: Hindu/Buddhist/Christian content akan ditambah." |
| S9 | Card intros | "Personalisasi pembelajaran ikut nilai keagamaan anda. Boleh toggle off bila-bila masa." · "Bagi konteks supaya AI dan content lebih relevan. Tidak diwajibkan." |
| S10 | 404 | "404" · "🔍" · "Halaman Tidak Dijumpai" · "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?" · "Halaman Utama" · "Mula Latihan" · "PRESTASIPLUS" |
| S11 | Empty | "Tiada notifikasi" / "Notifikasi baru akan muncul di sini" |
| S11 | Selection | "{n} dipilih" |
| S11 | Confirm (native) | "Padam notifikasi ini?" · "Padam {n} notifikasi yang dipilih?" |
| S11 | Pagination (English, exact) | "Showing {from} to {to} of {total} results" · "« Previous" · "Next »" · aria "&laquo; Previous", "Next &raquo;", "Go to page {n}" |
| S11 | Relative time | "{n} … yang lepas" (BR-20) |
| S11 | Delete tooltip | "Padam" (`title`) |
| All | After login / logout | (no message) |

**UNVERIFIED COPY (post-submit; placeholders until URS OQ-1 is resolved).**
- Success messages show in a green alert box (green-50 background, green-200 border, green-700 text, circle-check icon) at the top of the form card (auth pages) or the top of `main` (account pages). This is INFERRED from the error-box pattern.
- Error messages use the observed red alert box.

| Situation | Prototype copy | Basis |
|---|---|---|
| Login throttled | "Too many login attempts. Please try again in {n} seconds." | Laravel `auth.throttle` |
| Login refused, account inactive | "Akaun anda tidak aktif. Sila hubungi pentadbir." | Placeholder (shared with M02) |
| Register errors | see §5 | Laravel validation defaults |
| Forgot: sent | "We have emailed your password reset link." | Laravel `passwords.sent` |
| Forgot: unknown email | "We can't find a user with that email address." | Laravel `passwords.user` |
| Forgot: throttled | "Please wait before retrying." | Laravel `passwords.throttled` |
| Token reset: success (flash to landing) | "Your password has been reset." | Laravel `passwords.reset` |
| Token reset: invalid | "This password reset token is invalid." | Laravel `passwords.token` |
| IC reset: no match | "Email atau No Kad Pengenalan tidak sepadan." | Placeholder |
| Profile saved | "Profil berjaya dikemaskini." | Placeholder |
| Picture saved | "Gambar profil berjaya dikemaskini." | Placeholder |
| Password changed | "Kata laluan berjaya dikemaskini." | Placeholder |
| Settings saved | "Tetapan berjaya disimpan." | Placeholder |
| Read-all / bulk actions | (no message; list reloads) | INFERRED |
| Generic failure (any form) | "Ralat berlaku. Sila cuba lagi." Shown in the red alert box only for a network failure or an HTTP 5xx with no usable message. | INFERRED; UNVERIFIED COPY (live copy unobserved) |
| S4 reset failure: field state | After a failed reset, both password fields are cleared and the email is kept. This mirrors Laravel's `withInput`, which excludes passwords. | INFERRED |
| S4 reset success: flash | The flash "Your password has been reset." passes through unchanged to the landing page. | INFERRED; UNVERIFIED COPY |
| S9 loading (settings load) | A load spinner is shown until `GET /api/me/settings` returns. | INFERRED (not observed on live) |
| S9 load error | A red alert (the observed error-box pattern) with the generic line "Ralat berlaku. Sila cuba lagi." and a "Cuba lagi" retry button that repeats the load. | INFERRED; UNVERIFIED COPY (live copy unobserved) |
| S8 / S9 saving | While a save is in flight the button keeps its label, its emoji or icon is replaced by a spinner, and the button is disabled. | INFERRED (not observed on live) |
| S9 saved | "Tetapan berjaya disimpan." (see the Settings saved row above) | **UNVERIFIED COPY** (unchanged; the live text was not captured) |

## 9. Permissions matrix

All M01 data is the user's own. No role can view or change another user's M01 data here; user administration is M02.

| Role | Can view | Can create | Can edit | Can delete | Notes |
|---|---|---|---|---|---|
| Guest | S1–S5, S10; public stats; school search | Own account (Pelajar/Guru/Ibu Bapa) | — | — | Protected routes → `/login` |
| Pelajar | S1–S11 (S1/S2 still render) | Profile picture | Profile, level, school, password, settings; notifications read state | Own notifications | IC reset possible if an IC is stored. Landing `/dashboard` (INFERRED) |
| Guru | as Pelajar | as Pelajar | as Pelajar ("Tahap" shown as live) | as Pelajar | No IC → IC reset impossible. Landing `/dashboard` (INFERRED) |
| Ibu Bapa | as Guru | as Guru | as Guru | as Guru | Landing `/dashboard` (INFERRED) |
| Admin | as Guru; `/tetapan` in the admin shell | as Guru | as Guru | as Guru | Landing `/admin` (OBSERVED) |
| Penaja (`sponsor`) / Admin Sekolah (`school_admin`) / Pegawai PPD (`ppd_officer`) / Pegawai JPN (`jpn_officer`) | as Guru | as Guru | as Guru | as Guru | Cannot self-register on S2 (created in M02). Landing per BR-07 (INFERRED) |
| Any role with `isActive = false` | S1–S5, S10 only | — | — | — | Login refused (BR-23) |

## 10. Responsive behaviour

The live site uses a single 1024px shell breakpoint (plus `md` for auth pages and `sm` for pagination). The rebuild keeps the live layout at each width, mapped to Tailwind breakpoints (NFR-RESP-02). Only DV-07, DV-08, DV-10, DV-11 and DV-19 change it (DV-09 withdrawn). No horizontal page scroll at 320–1920px, and touch targets ≥44px (NFR-RESP-01/03).

| Screen | 375 (mobile) | 768 (tablet) | 1280 (desktop) | Breakpoints | Deviation |
|---|---|---|---|---|---|
| S1 `/login` | One column. Welcome panel hidden. Card full width (12px margin as live, `p-3`). Stats strip compact, items wrap whole. Emoji may overlap the card edges (decorative, as live, clipped by the page). | One centred column (card ≤560px). Welcome panel hidden. | Two columns: welcome panel + 560px card. Strip on one line. | 2 columns at `lg` | DV-07 (live: at `md`) |
| S2 `/register` | One column. Role cards 3 across. Darjah 3×2, Ting 5 across (as live). State select + search side by side (as live), also at 320px. The school search placeholder "Taip nama sekolah..." is truncated at 320px; this follows the live layout (D9 "when unsure, follow live") and is not a deviation. | One centred column (≤560px): no clipped select, placeholder or subtitles. | Two columns. | 2 columns at `lg` | DV-07 |
| S3/S4/S5 | Centred card, full width minus 12px margins. | Centred card 448px. | Same. | — | none |
| User shell (S7, S8, S11) | Mobile shell: compact header (title, truncated subtitle, bell + badge, hamburger, logo), drawer with the user card and account links (incl. "Tetapan" → `/tetapan`), bottom nav. | Same as 375 (live uses the mobile shell below 1024). | Sidebar 256px (identity card, "Profil Saya", "Tetapan Peribadi", logout icon) + full header (chips, bell, avatar, logout). | Shell switch at `lg` (NFR-RESP-04) | DV-01 (drawer link) |
| Admin shell (S9) | Header (title, logo). Bottom nav with the "Lagi" menu (incl. "Log Keluar"). | Same as 375. | Sidebar with the footer user block + logout; header with the server-status pill, avatar and logout. | `lg` | DV-13 (header title "Tetapan Peribadi") |
| S7 `/profile` | Hero card full width, content centred and stacked. | Same. | Same (full main width). | — | DV-14 (white name; extended to the white email and "Ahli sejak" lines) |
| S8 `/profile/edit` | Cards stacked full width. Grade grid 6 columns from 360px (as live, ≈45px each at 375); 3 columns below 360px (DV-19: at 320px a 6-column card is ≈38.7px, under 44px, and "Darjah" is clipped). Actions row inline, as live: "Kembali" left, "Simpan Profil" right, within the card column (no overflow). | Same. | Same. | below 360px | DV-19 (DV-09 withdrawn) |
| S9 `/tetapan` | Each row stacks: checkbox + label + description, then the time input full width. Faith select full width. | Row: checkbox + text left, time input right (as live). | Same, column ≈728px. | Row layout at `sm` | DV-08 |
| S10 404 | Full-screen gradient, centred content, pills stack if needed. | Same. | Same. | — | DV-02 (link) |
| S11 `/notifikasi` | Full width. Title row keeps "Tanda semua dibaca" + "Pilih". Filter strip scrolls horizontally inside its container with no visible scrollbar. Delete button always visible (touch, DV-11). Pagination "« Previous" / "Next »". | Full width. Pills fit or wrap. Full pagination with the "Showing…" text. | Centred 640px column. Pills fit or wrap. Delete on hover. | Pagination variant at `sm` | DV-10, DV-11 |

## 11. Non-functional requirements

| ID | Category | Requirement | Specialises |
|---|---|---|---|
| NFR-M01-01 | Fidelity override | M01 overrides UR-G-07 / FR-G-09 (custom BM field errors) and FR-G-10 (error state for the school search), per D7: the live site uses native browser validation and a silent search failure. Reason: D7 (replicate, don't redesign). | UR-G-07, FR-G-09, FR-G-10 |
| NFR-M01-02 | Testability | The mock layer SHALL have configurable latency (default 400 ms, so the loading labels are observable), fault injection (`mock.failNext`), state reset (`mock.reset`), session expiry (`mock.expireSession`), simulated push (`mock.pushNotification`) and the reset-token outbox. These are available in dev/E2E builds only. | NFR-07 |
| NFR-M01-03 | Privacy | Seed data is fictitious (NFR-05). `icNumber` is persisted only as a salted SHA-256 hash (F-11 as-built), is never returned by any M01 (self/non-admin) endpoint, and is never logged or shown after entry in M01. Admin endpoints in M02 return it in full, as live (SEC-M02-07, security-engineer review). Passwords are never stored in browser storage. | NFR-05 |
| NFR-M01-04 | Security — for the backend phase (**security-engineer review required**) | The live behaviour replicated here carries these risks, to be reviewed before the backend is built:<br>**SEC-M01-01** the IC reset authenticates with email + a semi-public IC number;<br>**SEC-M01-02** logout via GET is CSRF-triggerable;<br>**SEC-M01-03** forgot-password and register reveal whether an email exists;<br>**SEC-M01-04** login throttling is unverified;<br>**SEC-M01-05** picture uploads must be validated and re-encoded server-side;<br>**SEC-M01-06** regenerate the session on login. | NFR-04 |
| NFR-M01-05 | Accessibility | Labels as live. The profile name, email and "Ahli sejak" lines are white for contrast (DV-14 and its extension). As built (D10, replicates live): the S8 grade radios and the picture file input are `display:none` as live, and no aria-labels are added on the S8 or S9 controls. The role and level cards stay click/tap only, as live (DV-15 rejected under rule D9: a known gap against NFR-02, accepted by the user). Animations (`coolGradient`, `floatBounce`, `btn-bounce`) SHALL respect `prefers-reduced-motion` (the live bundle includes this query). | NFR-02 |
| NFR-M01-06 | Visual fidelity | Colours, gradients, radii and icons follow `00-global-ui.md` §6, with Font Awesome → Lucide mapping (e.g. `fa-eye`/`fa-eye-slash` → `Eye`/`EyeOff`, `fa-id-card` → `IdCard`, `fa-circle-notch` → `LoaderCircle`). Emoji are kept as live. | — |

## 12. E2E test scenarios

Every scenario runs on the **mobile (375×812), tablet (768×1024) and desktop (1280×800)** Playwright projects, starts from `mock.reset()` and uses the §6.8 seed accounts. Assertions are viewport-aware where the live layout differs by width.

| ID | Scenario (abridged) | ACs | FRs |
|---|---|---|---|
| E2E-M01-01 | `/login` content: emoji, logo, tagline, footer, links + hrefs; the stats strip shows the derived values: `questionCount` = the M04 repository's `namedCount('Q-ELIGIBLE')` (128,989 with the standard dataset), and `subjectCount` / `levelCount` = the M03 counts (31 / 11); welcome panel + tiles visible only on desktop. | 02.1–02.4 | 01, 02, 06, 11 |
| E2E-M01-02 | Login native validation: empty submit and a bad email are blocked (`:invalid`, no request made). | 01.2 | 08 |
| E2E-M01-03 | Admin login: loading label "Sedang Memasuki..." with the button disabled → `/admin`, no flash/toast; with the mock clock fixed, `GET /api/me` returns `lastLoginAt` = that time; a failed attempt before it did not change the value. | 01.1, 01.3, 04.1 | 03, 07, 12 |
| E2E-M01-04 | Landing per role (parametrised over the seed accounts) matches BR-07. | 04.3 | 12 |
| E2E-M01-05 | Wrong password and unknown email → the same alert text; email kept; password empty. | 01.4 | 09 |
| E2E-M01-06 | 6 failed attempts → throttle message in the alert. | 01.5 | 10 |
| E2E-M01-07 | Eye toggle: type password↔text, icon eye↔eye-slash, does not submit. | 03.1 | 04 |
| E2E-M01-08 | Remember me: ticked → new context keeps the session after the 120 min clock; unticked → session expires after 120 min idle (Playwright clock). | 03.2 | 05 |
| E2E-M01-09 | Guest opens `/notifikasi` → `/login` → login as admin → `/admin` (intended URL ignored). | 04.2, 05.1 | 12, 14 |
| E2E-M01-10 | Logged in → `/login` and `/register` render the guest content, with no redirect. | 04.4 | 13 |
| E2E-M01-11 | Guest → each protected route → `/login` with no message; `mock.expireSession()` → next data call → `/login`. | 05.1, 05.2 | 14 |
| E2E-M01-12 | `/register` content: stepper 1-2-3 static, fields/placeholders/maxlength, links + hrefs, footer, welcome panel on desktop only. | 06.1–06.3 | 01, 15, 16, 17 |
| E2E-M01-13 | `/register?role=teacher`, `?role=parent`, `?ref=X` → Pelajar selected, the same field set; with `?ref=` + the admin's code "4JURJTT", `pp.pendingRef` holds it, the register request body has `referralCode: "4JURJTT"`, M14 records the referral (BR-M14-19), and `pp.pendingRef` is then cleared (provisional). | 06.4, 06.5 | 18, 70 |
| E2E-M01-14 | Role cards: default Pelajar; Guru hides the level + IC; Ibu Bapa hides the level + IC; Pelajar shows them again; level click highlights; payload grade = n / n+6; IC maxlength 14 + hint. | 07.1–07.4 | 19, 20, 21 |
| E2E-M01-15 | School search: state labels (KL, N.Sembilan, P.Pinang); focus opens; type "de" → ≤15 rows with "{type} · {state} · {district}", where the district is as stored (e.g. "PPD SEGAMAT", and in Perlis "JPN PERLIS"); choose a state with an empty query → rows; "zzz" → "Tiada sekolah dijumpai"; pick → chip "type · state"; ✕ restores; outside click closes. | 08.1–08.4 | 22 |
| E2E-M01-16 | Register password hint "Minimum 6 aksara", two independent toggles, native required blocking, loading "Sedang Mendaftar...". | 09.1–09.3 | 04, 08, 23, 24 |
| E2E-M01-17 | Register Pelajar with level + school → logged in → `/dashboard` (M05) with a new id ≥ 9,000,001 (the next id in creation order); the new account shows the BR-24 defaults: `/notifikasi` empty state and no bell badge, `/tetapan` defaults, initials avatar, and the M05 dashboard empty state (0 sessions, full 50-question trial). Guru → `/dashboard`. | 09.4 | 25 |
| E2E-M01-18 | Register with a taken email / 5-character password / mismatch / Pelajar without level → red alert with the §5 messages; inputs kept except passwords. | 09.5 | 26 |
| E2E-M01-19 | `/password/reset` content (no IC link), autofocus, native validation, loading "Menghantar...". | 10.1, 10.2, 10.4 | 08, 27, 28 |
| E2E-M01-20 | Forgot: registered email → green "sent" status + outbox token; unknown → red error; repeat within 60 s → throttle message. | 10.3 | 29 |
| E2E-M01-21 | `/password/reset/demo-reset-token?email=pelajar@demo.test` → pre-filled; without `?email` → empty; any token renders; two toggles; loading "Menukar...". | 11.1–11.3 | 30, 31 |
| E2E-M01-22 | Valid token + new password → logged in at the landing page; the old password fails and the new one works; `demo-expired-token` → invalid-token alert. | 11.4 | 32 |
| E2E-M01-23 | `/password/reset-ic` content, IC maxlength 14, hint, loading "Memproses...". | 12.1, 12.2 | 33, 34 |
| E2E-M01-24 | pelajar + correct IC → S4 pre-filled → reset works; wrong IC / pelajar2 → mismatch alert. | 12.3 | 35 |
| E2E-M01-25 | Logout from the user shell (desktop sidebar icon, header icon; drawer "Log Keluar" on mobile/tablet) and the admin shell (sidebar/header icons; "Lagi" → "Log Keluar") → `/login`, no message, no dialog; Back/protected → `/login`. | 13.1–13.3 | 36, 37 |
| E2E-M01-26 | `/profile`: header texts, avatar image + crown, name in white with AA contrast (DV-14), email, "Ahli sejak {d MMMM yyyy}" in BM, "Kemaskini Profil" → `/profile/edit`; no stats block. | 14.1–14.3 | 38 |
| E2E-M01-27 | Picture: hover overlay (desktop), "Pilih Gambar" opens a chooser with accept; choosing a PNG → preview + "Simpan" visible, no request; "Simpan" → new avatar in the card, `/profile` and the shell; a GIF → error alert. | 15.1–15.3 | 41 |
| E2E-M01-28 | Details: header texts, email disabled + hint, placeholders, counter "Baki: 500 aksara", still "Baki: 500 aksara" after typing "abc" and after saving a non-empty bio; "Kembali" → `/profile`; save → values persisted + flash; empty name → native block. | 16.1, 16.3, 16.4 | 39, 44 |
| E2E-M01-29 | Tahap: admin sees "SEKOLAH RENDAH" (rendered text) with Darjah 1–6 and Darjah 4 checked; pelajar (grade 10) sees "SEKOLAH MENENGAH" Ting. 1–5 with Ting. 4 checked; change + save persists. | 16.2 | 40 |
| E2E-M01-30 | Profile school: chip with separators; clear → "Semua Negeri" + full names + placeholder; focus/type → ≤20 rows with icons; state-only → rows; "zzz" → two-line empty state; failing search (`mock.failNext`) → nothing shown; pick → chip; save persists. | 17.1–17.5 | 42, 43 |
| E2E-M01-31 | Change password: labels, hint "Sekurang-kurangnya 6 aksara", no toggles, no required; wrong current → error; valid → flash, fields cleared, still logged in; the new password works at the next login. | 18.1, 18.2 | 45 |
| E2E-M01-32 | `/tetapan`: hero, cards, exact descriptions, faith options, defaults (guru), ticking boxes changes nothing else, times always editable. | 19.1–19.3 | 46 |
| E2E-M01-33 | `/tetapan` as admin → admin shell, header "Tetapan Peribadi" (DV-13), tab title "Tetapan Peribadi". | 19.4 | 47 |
| E2E-M01-34 | Save settings → flash; reload shows the saved values. | 19.5 | 48 |
| E2E-M01-35 | Shell account links + hrefs (desktop sidebar; drawer on mobile/tablet; admin sidebar) and identity blocks (name, email, "admin"/"Admin", avatars). | 20.1–20.3 | 51, 52 |
| E2E-M01-36 | Drawer "Tetapan" → `/tetapan` (mobile/tablet); desktop: `/settings` typed → 404 content, "Mula Latihan" href `/practice`, "Halaman Utama" href `/`, tab title. | 21.1, 21.2 | 49, 50 |
| E2E-M01-37 | Bell: admin badge "99+" → `/notifikasi`; pelajar badge "12"; ibubapa no badge; after marking all read the refreshed badge is hidden. | 22.1, 22.2 | 53 |
| E2E-M01-38 | Inbox: header texts, "Peti Masuk" pill 166 (admin); pills "Semua (167)", "Belum Dibaca (166)", "Sudah Dibaca"; filters (unread/read/each category for pelajar) show matching items + the active status pill; with a category filter active, that category pill is highlighted (DV-12); item parts, uppercase type, BM relative time, unread styling. | 23.1–23.3 | 54, 55, 56 |
| E2E-M01-39 | Pagination: desktop/tablet "Showing 1 to 20 of 167 results", links 1…9, page 9 has 7 items; `?filter=unread&page=2` links keep the filter; mobile "« Previous" (text on page 1) / "Next »". | 23.4 | 57 |
| E2E-M01-40 | Empty (ibubapa; admin `?type=system`): texts shown, "Pilih" absent, "Tanda semua dibaca" present. | 23.5 | 58 |
| E2E-M01-41 | Click an unread item → read style, no navigation; after reload the counts decrease. | 24.1 | 59 |
| E2E-M01-42 | "Tanda semua dibaca" → reload, all read, pill/badge hidden. | 24.2 | 60 |
| E2E-M01-43 | Delete: the button has title "Padam"; on desktop it has opacity 0 until hovered; on the touch projects (mobile/tablet with `hasTouch`) it is visible without hover (DV-11); confirm dismissed → kept; accepted → gone after reload. | 24.3 | 61 |
| E2E-M01-44 | Select mode: header actions + bins hidden, checkboxes shown, item click inert; tick 2 → "2 dipilih" + actions; "Pilih Semua" → "20 dipilih"; "Batal" restores. | 25.1–25.3, 25.6 | 62 |
| E2E-M01-45 | Bulk "Tanda Dibaca" on 3 items → reload, the 3 are read. | 25.4 | 63 |
| E2E-M01-46 | Bulk "Padam" on 2 → confirm "Padam 2 notifikasi yang dipilih?" → accepted → removed. | 25.5 | 64 |
| E2E-M01-47 | Responsive sweep over every M01 route: no page h-scroll; auth pages 1 column below `lg`, 2 at `lg`; `/tetapan` stacked below `sm`; `/profile/edit` actions row inline (Kembali left, Simpan Profil right) and within the viewport at every width; no visible native scrollbar on the filter strip; tab titles per §2; no visible M01 content text has a computed font-size below 12px (DV-16). | 26.1–26.3, 26.5, 26.7 | 65, 67 |
| E2E-M01-48 | Role and level cards: selecting by click/tap changes the role and the level, as live (DV-15 rejected: no keyboard semantics are added). | 26.6 | 19, 20, 66 |
| E2E-M01-49 | Badge refresh (Playwright clock): open `/profile` as pelajar (badge "12") → `mock.pushNotification` without a push event, then advance 60 s → badge "13" with no reload; `mock.pushNotification` with the push event → badge updates immediately; mark all read in another tab and advance 60 s → badge hidden. | 22.3 | 53, 59 |
| E2E-M01-50 | Inactive account: `tidakaktif@demo.test` + correct password → red alert "Akaun anda tidak aktif. Sila hubungi pentadbir.", email kept, password empty, still on `/login`, no session stored. | 01.6 | 68 |
| E2E-M01-51 | Login hook: at the fixture clock, a **form** login as pelajar (2) and as pelajarmaju (4) each calls `gamification.onLogin` once, with the header chips 372 and 269 (the M14 designed 370 / 267 + 2 `daily_login`, XL3-30); a second form login the same day adds nothing; a `setUser` fast login does not call the hook (chips stay 370 / 267); a failed login calls nothing. | 01.7 | 69 |

**Coverage:** 101/101 active URS ACs → ≥1 scenario (AC-M01-26.4 withdrawn); 70/70 FRs → ≥1 scenario; 111/111 FNs → ≥1 FR; 51 scenarios.

## 13. Open questions

| # | Question | Tag |
|---|---|---|
| Q1 | URS OQ-1 … OQ-9 (post-submit copy and results, IC-reset flow, role landing pages, non-admin `/profile`, "Tahap" rule, `/tetapan` shell for non-admins, "Peti Masuk" pill at zero, type-code/category mapping, remember-me duration). | inferred |
| Q2 | Master SRS §7: add `RATE_LIMITED` (429, `retryAfter`) to the error codes, and allow optional `meta` extensions (`from`, `to`, `counts`) in the list envelope. This affects all modules. | master SRS change |
| Q3 | *(Closed 2026-09-25, rule D9)* Deviations decided: DV-01…08 and DV-10…14 approved; DV-15 rejected; DV-09 withdrawn. | closed |
| Q4 | *(Answered by M02, v1.3)* Parent ↔ child linking: done by admins in M02 (many-to-many `ParentStudentLink`); no parent self-service; M01 registration is unchanged. *(v1.16 note, D23: a link can also be created from the student side, when a logged-in parent opens a student's invite link; see [L45](L45-jemput-ibu-bapa.md). Registration and login stay unchanged.)* | closed |
| Q5 | *(Answered by M02, v1.3)* School types: the M02 enum SK, SMK, SJK(C), SJK(T), MRSM, SBP (data SK/SMK only); M01 displays the stored type. | closed |
| Q6 | *(Closed v1.6, XL-25)* M02 DATA-M02-01 now lists only the 8 live role codes; the earlier `duta\|seller\|tuition_centre` note is gone. | closed |
| Q7 | *(Closed v1.10, Delivery Lead decision 2026-09-27)* The secrets store holds `{passwordHash, icHash, icMasked, salt}`; `icMasked` uses the live mask format `xxxxxx-xx-` + the last 2 digits (e.g. `xxxxxx-xx-01`); `verifyIc` compares hashes (BR-12). The M02 admin detail shows the full fictitious IC of **seeded** accounts from the in-memory fixture map (`adminIcNumber`, as live). For ICs entered or changed at runtime, the admin sees only `icMasked`: a privacy deviation from live, recorded by M02 in SEC-M02-07. | closed |
| Q8 | *(Closed v1.16, user decision D23c, 2026-10-02)* Avatar source. The initials avatar stays the shell's local SVG data URL (`src/shells/shared/avatar.ts`); live's external ui-avatars.com URL is not called (D4). BR-15 colours and sizes unchanged. | closed |
| Q9 | Design token (for the designer): the S7 hero gradient #667EEA→#764BA2 has no design token. Needs a token or a recorded decision to keep it as a literal. | open (designer) |
| Q10 | Faith data of minors (SEC-M01-18): is guardian consent required? Product and legal decision for the real backend. | open (backend phase) |

## 14. Real-backend security requirements (from G4 security review, 2026-09-30)

Every item is **backend-only; prototype replicates live** (D9: the live behaviour works, so the mock and its copy are unchanged). They extend NFR-M01-04 (SEC-M01-01…06; the list now runs SEC-M01-07…23) and are binding on the real backend.

| ID | Area | Requirement for the real backend | Related |
|---|---|---|---|
| SEC-M01-07 | IC reset (`POST /api/auth/password/reset-ic`) | (a) Throttle to at least 5 attempts per 60 s, keyed by email and IP; failed attempts count. (b) Deliver or bind the reset token (e.g. to the requesting email or session) instead of returning it in the response body. (c) Apply the inactive-account check (BR-23, BR-27). *Backend-only; prototype replicates live.* | SEC-M01-01, BR-12, BR-23, BR-27, URS OQ-2 |
| SEC-M01-08 | Password reset or change | On reset, revoke all of the user's sessions. On change, revoke all sessions except the current one (BR-16 keeps the current session). *Backend-only; prototype replicates live.* | BR-11, BR-16 |
| SEC-M01-09 | Forgot password | Consider a neutral reply ("if the account exists…") and a per-IP throttle. Live returns Laravel's "We can't find a user with that email address."; the prototype keeps that copy. *Backend-only; prototype replicates live.* | SEC-M01-03, BR-10 |
| SEC-M01-10 | Profile picture | (a) Sniff the magic bytes (do not trust the extension or client MIME type). (b) Decode and re-encode the image (strips EXIF/GPS and polyglot payloads) and enforce pixel-dimension caps. (c) Store under a random server-generated filename. (d) Serve with a fixed `Content-Type` and `X-Content-Type-Options: nosniff`, ideally from a separate cookieless origin. (e) Enforce the size limit at the gateway as well as in the app. (f) Return a URL, never inline data, and never store base64 in the user row. (g) Set a CSP `img-src` that allows that origin. *Backend-only; prototype replicates live. Extended in v1.15 (merged with the G4 T6 review items).* | SEC-M01-05, BR-15 |
| SEC-M01-11 | Login throttle | Key by email and IP, and add a global per-IP limit. *Backend-only; prototype replicates live.* | SEC-M01-04, BR-02 |
| SEC-M01-12 | Demo seeds | The demo accounts, demo password and demo reset tokens (§6.8, dev outbox) are mock-only and must never appear in real-backend fixtures. *Backend-only; prototype replicates live.* | §6.8, NFR-M01-02 |
| SEC-M01-13 | Logout (`POST /api/auth/logout`, S6) | (a) Invalidate the token or session server-side, and any remember token. (b) Idempotent: a dead or unknown token still returns 204. (c) Expire the session cookie. (d) If a `GET /logout` is kept with cookie sessions, make it CSRF-safe (POST-only, or SameSite cookies). (e) The client logout call needs a timeout or abort, so a hanging request cannot stall the redirect and the local session clear. *Backend-only; prototype replicates live.* | SEC-M01-02, FR-M01-36, FR-M01-37, BR-16 |
| SEC-M01-14 | Cache control | Send `Cache-Control: no-store` on authenticated API responses and on HTML pages, so the Back button and shared caches never show another user's data after logout. *Backend-only; prototype replicates live.* | SEC-M01-13 |
| SEC-M01-15 | Token storage | A Bearer token in `localStorage` is readable by any XSS. Prefer an HttpOnly cookie session; otherwise require a strict CSP and sanitised rendering of all user-supplied content. *Backend-only; prototype replicates live.* | SEC-M01-06, NFR-M01-03 |
| SEC-M01-16 | Push channel (notification badge) | The channel is authenticated per user and carries only that user's events. The client treats the payload as untrusted and only refetches the unread count (it never renders payload content). *Backend-only; prototype replicates live.* | FR-M01-53, FR-M01-59, M22 |
| SEC-M01-17 | Cross-tab logout (optional) | Logging out in one tab SHOULD log out the others (storage event or BroadcastChannel). *Backend-only; optional; prototype replicates live.* | SEC-M01-13 |
| SEC-M01-18 | Faith ("Latar Agama") data | Special-category data under PDPA. (a) Explicit, informed consent with a notice of purpose, recipients and retention, and a stored consent record. (b) The field is optional; sending null erases it. (c) Withdrawing consent clears every derived flag. (d) Encrypt at rest. (e) Exclude it from lists, exports, admin and teacher views, analytics and non-production backups. (f) Do not send it to a third-party AI without consent that covers it; prefer a derived signal. (g) Never log it. (h) Include it in access, correction and deletion requests. (i) For minors, whether guardian consent is required is a product decision (Q10). *Backend-only; prototype replicates live.* | DATA-M01-03, FR-M01-46, FR-M01-48, Q10 |
| SEC-M01-19 | Settings API (`PUT /api/me/settings`) | (a) Take the user id from the session only, never from the body or path. (b) Strict allow-list DTO; the contract is **422 on unknown keys** (a stricter reading than silently ignoring them is chosen so client bugs surface). (c) Re-validate enum values and `HH:mm` times server-side. (d) Rate-limit PUT. (e) CSRF protection for cookie sessions. (f) Audit-log faith changes without logging the value. (g) Store the user's time zone, so push times are interpreted correctly. *Backend-only; prototype replicates live.* | SEC-M01-18, FR-M01-48, §5 |
| SEC-M01-20 | Request body parsing | Parse JSON bodies in a prototype-pollution-safe way: skip or reject the keys `__proto__`, `constructor` and `prototype`. *Backend-only; prototype replicates live.* | SEC-M01-19, SEC-M01-22 |
| SEC-M01-21 | Password change (extends SEC-M01-08) | (a) Throttle current-password verification per user and IP, sharing the login lockout counter (SEC-M01-11). (b) Maximum password length about 255 characters. (c) Optional: reject new password equal to the current one. (d) Revoke other sessions and refresh tokens on change (SEC-M01-08). (e) Send a "password changed" notification. (f) Write an audit event that holds no password material. *Backend-only; prototype replicates live.* | SEC-M01-08, SEC-M01-11, FR-M01-45 |
| SEC-M01-22 | Profile update (`PUT /api/me`) | Allow-list the body: never accept `email`, `role`, `avatarUrl` or `subscription`. Avatar, phone and bio are personal data: visible to the owner and admins only, and never logged. *Backend-only; prototype replicates live.* | SEC-M01-10, SEC-M01-20, NFR-M01-03 |
| SEC-M01-23 | School search (`GET /api/schools/search`, owned by M02) | Rate-limit; cap results at 20 server-side; cap the query length; use a parameterised `LIKE` with escaped wildcards (`%`, `_`); add anti-scraping controls. This tightens the M02-owned endpoint (v1.4: "no enforced maximum" is the live behaviour; the real backend caps). *Backend-only; prototype replicates live.* | FR-M01-22, FR-M01-43, M02 |
