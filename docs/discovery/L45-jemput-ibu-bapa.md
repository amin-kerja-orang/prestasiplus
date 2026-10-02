# L45 — Jemput Ibu Bapa (roles-matrix item #40, group Pembelajaran, role Murid)

Discovery status: **PARTIAL — authenticated page NOT observed.** Date 2026-10-02, Playwright lane 2, guest session, plain GET probes only.

## 1. Why the page was not opened
- The admin credentials are not in the repo, the memory files, the discovery jobs or the environment (earlier discovery docs state they are "in no file" and were supplied in the session). This agent was not given them, so lane 2 could not log in. Nothing was submitted; no login attempt was made.
- Per D16 only an admin account exists anyway. `/jemput-ibu-bapa` is a student route (menu role Murid), so for the admin it may be 403 / redirect / render (as for other student routes, e.g. `/laporan-mingguan` was 403 for admin, R10). **NOT OBSERVED.**
- To finish: re-run this job with the admin login (lane 2, guard pattern of `tools/jobs/R10-guard.js`) and open `/jemput-ibu-bapa` (GET only; do NOT press "Jana Link Baru").

## 2. Route probes (guest, `fetch` GET, `redirect: manual`, 600 ms apart)
| Path | Result | Reading |
|---|---|---|
| `/jemput-ibu-bapa` | redirect (opaque) → follows to `/login` (200) | **Route exists, auth-guarded** (a nonexistent path gives 404) |
| `/jemput-ibu-bapa/` | redirect (same) | same |
| `/jemput-ibu-bapa/generate` | **405** | A route exists that accepts a non-GET method (POST) — consistent with a "generate new link" action. Not called with POST. |
| `/ibu-bapa/dashboard` | redirect (guest → login) | Parent portal route exists (guarded) |
| `/ibu-bapa/terima/0000` | 404 | Guest, dummy token. Either route absent or "invalid token" 404. NOT conclusive |
| `/ibu-bapa` , `/parent/invite`, `/jemput`, `/jemput-ibubapa`, `/murid/jemput-ibu-bapa`, `/ibu-bapa/jemput` | 404 | Do not exist |
| `/jemput-duta` (control) | redirect (guarded) | Existing sibling route |
| `/zzz-nonexistent-l45` (control) | 404 | |

Conclusion: the real URL is `/jemput-ibu-bapa` (the href in `src/shells/nav/user-nav.ts:467` is confirmed as an existing guarded live route). The live user-shell menu HTML (href/icon of the item) was not inspected because no logged-in session was available; the icon/colour in user-nav.ts (`fa-users`, `text-red-500`) is unverified. The only other source says `fa-user-friends`, `text-rose-500` (reference-only, §4).

## 3. Screens, inventory, copy, states, endpoints
**NOT OBSERVED** (0 screens, 0 elements, 0 screenshots, no inventory under `inventory/L45/`, no `img/L45/`). Nothing is invented here. Known only: GET page (guarded) and a POST `/jemput-ibu-bapa/generate` route (405 on GET).

## 4. Existing docs (what they say about parents)
- M01 (`M01-authentication.md`): register type "Ibu Bapa" ("Pantau anak saya", role `parent`), no IC; Q-M01-7 already asks "How is a parent linked to a child?" — unanswered. Role landing of parent is INFERRED `/dashboard`. `/robots.txt` disallows `/ibu-bapa/` (R10 §).
- M02 (`M02-users-schools.md`): parent↔child link is many-to-many, **admin-only** ("Pautkan Anak (Pelajar)" via `/api/students/search`, `linked_students[]` on create/edit parent). Bulk import cannot link parents to children. Live count 38 Ibu Bapa. No student-initiated invite seen there.
- M14 (`M14-gamification.md`): "Rujuk Kawan" (`/gamification/referral`, subtitle "Jemput kawan anda ke PRESTASIPLUS — dua-dua dapat ganjaran!", register `?ref=`) is a friend referral with coins, **not** a parent invite; no parent link.
- R10 (`R10-release-1-0-screens.md`): no "Jemput Ibu Bapa" screen. M08 `/laporan-mingguan` is described as student/parent weekly report.
- TRACKER lists `/jemput-duta` (ambassador invite, admin shell) — unrelated.
- `docs/ROLES-MATRIX-LINES.md` L45: owner "M01 / M02 (perlu pengesahan)".

## 5. Reference rebuild (SECONDARY, NOT live truth) — `D:\Dev Projects\prestasiplus-reference`
- `.planning/codebase/ROLE-PORTALS.md`: `/jemput-ibu-bapa` = "invite parents"; "students invite parents ... which surface in admin" ; `ORIGIN-SPEC-PELAJAR.md` row 75: Jemput Ibu Bapa, `/jemput-ibu-bapa`, `fa-user-friends`, `text-rose-500`. The parity audit lists it under `pelajar-missing/` (i.e. its authors apparently had no live capture of it).
- Their blade `backend/resources/views/pelajar/jemput-ibu-bapa.blade.php` + `StudentExtrasController` (reference-only, may be invented): title/heading "Jemput Ibu Bapa", sub "Kongsi link ini dengan ibu bapa untuk pantau perkembangan anda"; hero "Jemput Ibu Bapa 👨‍👩‍👧"; card "Link Jemputan" with "Salin link ini dan hantar kepada ibu bapa anda melalui WhatsApp atau mesej." , read-only input + "Salin" (→ "Disalin!"), "Hantar via WhatsApp" (message "Salam ibu/bapa! Klik link ini untuk pantau perkembangan saya di PRESTASIPLUS: {url}"), "Jana Link Baru" (POST `/jemput-ibu-bapa/generate`, flash "Link jemputan baru telah dijana!"); card "Ibu Bapa Dihubungkan" listing linked parents (name, email, relationship chip) or empty "Belum ada ibu bapa dihubungkan" / "Hantar link jemputan di atas". Invite URL `/ibu-bapa/terima/{64-hex token}` handled by a guest/parent landing that links a parent via a `parent_student` pivot; old tokens show an "invalid/expired" page.
- The only live-confirmed facts matching this: the `/jemput-ibu-bapa` route and `POST /jemput-ibu-bapa/generate` (405 on GET). Everything else is unverified.

## 6. Recommended owner module
**M02 (users & schools)** — it owns the parent↔student link (many-to-many; users/schools are M01/M02 per CLAUDE.md §6) and this screen creates/lists that link from the student side. M01 owns authentication/registration; the invite-acceptance side (`/ibu-bapa/terima/...` parent landing/registration, if it exists) would be the M01 part. Suggest: M02 owns the student screen + `parent_student` write contract; M01 owns acceptance/register of a parent. Needs user confirmation.

## 7. Open questions
1. Provide admin credentials (or approve a run) so `/jemput-ibu-bapa` can be opened read-only: does it render for admin, 403, or redirect?
2. Menu HTML: exact href, icon, colour of the live item (needs a logged-in shell).
3. Does the live page use an invite link/token (as the reference claims) or something else (code, email, form)? Does the acceptance route (`/ibu-bapa/terima/{token}`) exist on live (guest probe 404 was inconclusive)?
4. Does a student-created link replace admin-only linking in M02 (Q-M01-7)? Is a parent without an account registered through the link?
5. Owner confirmation: M02 (recommended) vs M01.
6. Since D16 means no student account, the full state set (empty / linked parents list) is likely not observable; accept PROPOSED behaviour for unobserved states?

## 8. UPDATE 2026-10-02 (lane 1, logged in as admin, GET only)
OBSERVED:
- `GET /jemput-ibu-bapa` as admin: **HTTP 403**, title "403 - Akses Ditolak | PRESTASIPLUS". Standalone error page (same as in M27): "403", "🚫", h1 "Akses Ditolak", "Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir.", links "Halaman Utama" → `/` and "Log Masuk" → `/login`, footer "PRESTASIPLUS". No personal data. Screenshots: `img/L45/jemput-ibu-bapa-403-desktop.png` (1280), `img/L45/jemput-ibu-bapa-403-mobile.png` (375). So the route has an auth plus role guard (murid only; admin denied; guest redirected to /login).
- Admin user shell (`/profile`, "Profil Saya - PRESTASIPLUS") renders the admin nav only: **no "Jemput Ibu Bapa" item** and no student-menu links (212 nav links; only Duta entries match "jemput|duta|ibu"). The real href, icon, colour, group and position of the menu item are therefore **NOT OBSERVED** (needs a murid account, D16). `user-nav.ts:467` (`/jemput-ibu-bapa`) matches the existing live route; icon and colour stay unverified (reference-only claim: `fa-user-friends`, `text-rose-500`).
- `GET /ibu-bapa/terima/0000` (admin, plain GET): **HTTP 404 with a custom page**, title "Link Tidak Sah — PRESTASIPLUS". This corrects the earlier inconclusive guest 404: the parent-invite acceptance route **exists** on live and renders an invalid-token state. Copy: "Link Tidak Sah" (icon `fa-link-slash text-slate-300`); "Link jemputan ini tidak sah atau telah tamat tempoh."; (`fa-info-circle`) "Link ini mungkin telah tamat tempoh atau dibatalkan. Sila minta anak anda menghantar jemputan baharu."; links "Log Masuk" (`fa-sign-in-alt`) → `/login`, "Laman Utama" (`fa-home`) → `/`; footer `fa-graduation-cap` "PRESTASIPLUS — Platform Latih Tubi Interaktif Malaysia" (link `/`). Screenshot `img/L45/terima-invalid-token-desktop.png` (1280 only). This shows live uses invite tokens/links sent by the student to the parent; the valid-token screen is NOT OBSERVED.
- Live `POST /jemput-ibu-bapa/generate` exists (405 on GET, section 2).

NOT OBSERVED (needs a murid account; none available, D16): the `/jemput-ibu-bapa` page content (heading, invite link field, copy/WhatsApp buttons, linked-parents list, empty state), the valid-token acceptance screen, the 375 drawer menu item.

REFERENCE-ONLY (not live): section 5. The reference blade/controller sit in its `pelajar-missing` set (replica server path `ripped/clone/pelajar-missing/`), i.e. not captured from live. Live now corroborates only: token-link design, route `/ibu-bapa/terima/{token}`, the "Link Tidak Sah" state, and `/jemput-ibu-bapa/generate`. The reference's copy for `/jemput-ibu-bapa` itself is unverified.

Recommended owner (revised): M02 for the student screen and the parent-student link; M01 for the guest-reachable `/ibu-bapa/terima/{token}` acceptance landing and parent register/login. User to confirm.
