# M01 — Element inventory & link crawl: summary

- **Captured:** 2026-09-25, live https://prestasiplus.my, read-only. Guest screens were captured in a separate cookie-less browser context. Logged-in screens used the admin account.
- **Method:** the inventory is built by scripts, not by judgement. `docs/discovery/tools/inventory.js` runs in the page and lists every element, including hidden ones. `tools/jobs/M01.js` is the capture plan: 58 UI states over 10 screens. `tools/run-state.js` executes the plan and `tools/split-batch.js` splits the output. `tools/merge-inventory.js` assigns the final IDs, merges the states and builds the crawl. `tools/diff-narrative.js` compares the inventory with the narrative doc.
- **Re-run:** follow the steps in the header of `inventory.js`. The job list is deterministic, so element IDs stay stable as long as the page DOM does not change.
- **Files:**
  - `S1-login.json` … `S11-notifikasi.json`: one file per screen.
  - `SHU-user-shell.json` and `SHA-admin-shell.json`: the layout chrome around the M01 screens. It is owned by the global UI doc and M23, not by M01.
  - `_crawl.json`: every URL found, with the module it belongs to.
  - `../_raw/M01/*.json`: the 58 raw per-state captures.
- **Privacy:** input values are never stored. Emails become `<email>` and long digit runs become `<digits:n>`. Notification items are masked (`<masked>`) and only 2 per page are kept. The only real-looking values left are the admin account's display name "Admin PRESTASI+" and the public school chosen in its profile.
- **Element status legend:**
  - `visible-default`: visible in the screen's default 1280 state.
  - `conditional`: hidden by default, but visible in at least one captured state (`visibleIn` names which).
  - `hidden-only`: never visible in any captured state. Examples: `x-if`/`x-for` templates, hidden fields, the upload input, the tournament banner with no active tournament.
  - `mobile-only`: visible only in some 375 state.
  - `desktop-only`: visible at 1280 by default but not at 375 by default.

## 1. Per-screen counts

M01 content totals **363 elements** over 10 screens and 58 captured states. The shells add a further 571 elements; they are layout chrome, not M01 content.

| Screen (route) | Total | Visible by default | Conditional | Hidden only | Mobile only | Desktop only | States | States captured (label@width) |
|---|---|---|---|---|---|---|---|---|
| S1-login `/login` | 47 | 43 | 1 | 3 | 0 | 13 | 4 | default@1280, pw-visible+loading@1280, logged-in-admin@1280, default@375 |
| S2-register `/register` | 86 | 70 | 7 | 9 | 0 | 13 | 13 | default, role-teacher, role-parent, grade-selected+pw-visible, school-search-results, school-search-empty, school-state-filter, school-selected, loading, query-role-teacher, query-ref (all @1280); default@375, role-parent@375 |
| S3-password-reset `/password/reset` | 14 | 10 | 1 | 3 | 0 | 0 | 3 | default@1280, loading@1280, default@375 |
| S4-password-reset-token `/password/reset/{token}` | 21 | 16 | 1 | 4 | 0 | 0 | 3 | default (with `?email=`)@1280, pw-visible+loading (no `?email`)@1280, default@375 |
| S5-password-reset-ic `/password/reset-ic` | 16 | 12 | 1 | 3 | 0 | 0 | 3 | default@1280, loading@1280, default@375 |
| S7-profile `/profile` | 8 | 5 | 0 | 3 | 0 | 0 | 3 | default@1280, default@375, drawer-open@375 |
| S8-profile-edit `/profile/edit` | 74 | 50 | 8 | 16 | 0 | 0 | 8 | default, school-cleared, school-search-results, school-search-empty, school-state-only, school-searching, bio-typed+file-chosen (all @1280); default@375 |
| S9-tetapan `/tetapan` | 22 | 20 | 0 | 2 | 0 | 0 | 4 | default@1280, all-on@1280, default@375, lagi-menu@375 |
| S10-settings-404 `/settings` | 7 | 7 | 0 | 0 | 0 | 0 | 2 | default@1280, default@375 |
| S11-notifikasi `/notifikasi` | 68 | 32 | 26 | 10 | 2 | 14 | 15 | default, filter-unread, filter-read, type-system, type-reminder, type-milestone, page-2, page-last, select-mode, select-one, select-all, hover-item (all @1280); default@375, select-one@375, type-milestone@375 |
| SHU-user-shell (S7/S8/S11 chrome) | 376 | 152 | 169 | 55 | 165 | 148 | 26 | all S7/S8/S11 states |
| SHA-admin-shell (S9 chrome) | 195 | 75 | 62 | 58 | 62 | 70 | 4 | all S9 states |

S6 (`/logout`) is a link inside the shells, and S12 (the redirect after login) is behaviour, so neither has an element file. Both are covered in §4.

## 2. Not in the narrative discovery (the key output)

Every item below was found by the inventory, the state captures or the probes, and is absent from `docs/discovery/M01-authentication.md` as of the start of this pass. All items have now been added to that doc, marked "(added in inventory pass)". ★ marks the most significant ones.

### S1 `/login`
1. The password eye toggle (EL-M01-S1-029) switches its icon from `fa-eye` to **`fa-eye-slash`** while the password is shown.
2. The "Reset melalui No IC" link uses the FA icon `fa-id-card`, not an emoji. "Kembali ke Laman Utama" uses `fa-arrow-left`.
3. In the loading state the submit button becomes a separate rendered button (EL-M01-S1-047): `disabled`, `fa-circle-notch`, "Sedang Memasuki...". Both labels come from `x-if` templates (S1-035/036).
4. ★ **No flash message after a successful login.** Neither a welcome nor a success message appears on `/admin`.
5. Opening `/login` while logged in renders exactly the same 46 elements as the guest view. There is no "already logged in" notice and no "continue to dashboard" link.
6. Session cookies are `prestasiplus-session` (HttpOnly) and `XSRF-TOKEN`. Both expire in less than 1 day when "Ingat saya" is not ticked. No remember cookie is set without "Ingat saya".
7. At 375, 13 elements are desktop-only: the whole left welcome panel, including the mascot and the 3 tiles.

### S2 `/register`
8. ★ The loading label is **"Sedang Mendaftar..."** (EL-M01-S2-083/076). The doc only said "follows the login pattern".
9. ★ **Query parameters are ignored.** `?role=teacher` and `?role=parent` do not preselect a role (it stays `student`). `?ref=CODE` adds no referral field or hidden input. The form fields are always `_token,name,email,phone,role,grade,ic_number,school_id,password,password_confirmation`.
10. The hidden `grade` input has `:required="selectedRole === 'student'"`, so it is HTML-required only for students. The grade buttons are generated by `x-for` over `[1..6]` (Darjah, value = n) and `[1..5]` (Ting., value = n + 6).
11. The grade sub-headings carry icons: "Sekolah Rendah" uses `fa-school` and "Sekolah Menengah" uses `fa-building`. The password hint uses `fa-info-circle` and the PDPA hint uses `fa-shield-alt`.
12. ★ School search dropdown behaviour:
    - It opens on input **focus** (`@focus`) and closes on **click outside** (`@click.outside`).
    - It is shown when `showSchoolDropdown && (results > 0 || query ≥ 2 chars)`.
    - It lists up to **15 rows**. Each row shows the NAME in bold, then "`type` · `state` · `PPD <district>`".
    - Choosing a state with an empty query also loads results for that state, which appear when the input is focused.
13. The selected-school chip on register shows the name, then "`type` · `state`" (no district, unlike the profile page), and a clear button (`fa-times`).
14. The empty state "Tiada sekolah dijumpai" has a `fa-search` icon. Its condition is `schoolResults.length === 0 && schoolSearch.length >= 2 && !searchingSchool`.
15. Both password toggles switch `fa-eye` → `fa-eye-slash`. Their state variables are `showPassword` and `showPasswordConfirm`.
16. The sponsor line "Mewakili organisasi?" uses the FA icon `fa-handshake`, and "Kembali ke Laman Utama" uses `fa-home`. They are FA icons, not the 🤝 / 🏠 emoji.
17. The role cards are `div`s with `@click`, not buttons. There is no keyboard or ARIA semantics (accessibility gap; rebuild them as real radio or buttons).

### S3 `/password/reset`
18. The back link uses the `fa-arrow-left` icon. The form's `x-data` is `{ loading: false }` on the form itself.

### S4 `/password/reset/{token}`
19. ★ The loading label is **"Menukar..."** (EL-M01-S4-021).
20. Without `?email=` the email field is **empty** (not prefilled). It stays editable and required.
21. Both new-password fields have `autocomplete=new-password`. The toggles switch `fa-eye` → `fa-eye-slash`.

### S5 `/password/reset-ic`
22. ★ The loading label is **"Memproses..."** (EL-M01-S5-016).
23. The IC field has `maxlength=20` and no `inputmode` or pattern (confirmed). The back link uses `fa-arrow-left`.

### S6 `/logout` and S12 (redirect after login)
24. Re-verified with a separate session:
    - A guest opening `/notifikasi` is sent to `/login`. After login they land on `/admin` (title "Dashboard - Admin Panel"), not on `/notifikasi`.
    - `/register` still renders while logged in.
    - `GET /logout` → `/login`, with no flash message.
25. For a guest, `/notifikasi/unread-count` returns **302 → /login**, not 401/JSON. The rebuild's mock API must decide what an unauthenticated JSON call returns.

### S7 `/profile`
26. Icons: "Ahli sejak" uses `fa-calendar-alt` and "Kemaskini Profil" uses `fa-pen`.
27. ★ `main` contains the global **tournament banner** (`tournamentBanner()`, owned by M16). It is hidden when no tournament is active. It has templates for "LIVE:" + "MAIN" (live match) and "DAFTAR" (registration open), and the x-text labels "Pendaftaran dibuka" / "Sedang berlangsung". The same component appears on S8 and S11.

### S8 `/profile/edit`
28. ★ **Avatar hover overlay:** a `label[for=profilePicInput]` with a black 40% overlay and a `fa-camera` icon. It is `opacity-0` and shows on hover (`group-hover`), and clicking it opens the file picker.
29. ★ `previewAvatar(input)` was confirmed from the page source. It is client-only: a `FileReader` replaces `#avatarPreview.src`, and the hidden `#uploadBtn` ("Simpan", `fa-check`) is un-hidden. It does **not** auto-submit.
30. The school chip shows "·" separators only when the state or district exists (`x-show`). The clear button uses `fa-times-circle`.
31. The profile school dropdown has the same open/close rules as register (focus / click-outside), with up to **20 rows**. Each row has a `fa-school` icon tile. Its condition is `showDropdown && (schools.length > 0 || searchQuery.length >= 2)`.
32. Choosing a state with an empty query loads that state's schools (for example, 20 rows for Perlis).
33. There is no "searching" indicator: while `searching=true` nothing is shown. The empty state is suppressed until the search finishes.
34. When the search fails, only `console.error('Search error:')` runs. **No UI error message** is shown.
35. The new- and confirm-password fields have `autocomplete=new-password`.
36. Icons:
    - "Kembali" uses `fa-arrow-left`.
    - "Simpan Profil" uses `fa-save`.
    - "Tukar Kata Laluan" uses `fa-shield-alt`.
    - The "Sekolah Rendah" sub-heading uses `fa-school`.
37. The grade radios are `display:none` inputs whose `<label>`s act as the cards. The current grade's radio is `checked`.

### S9 `/tetapan`
38. Ticking all 4 checkboxes reveals **no** extra UI. There is no Alpine on the page (no `x-data`), which confirms there is no client-side dependency. The time inputs are `type=time`. The checkboxes have value `1`.
39. The save button's "💾" is an emoji; there is no FA icon.

### S10 `/settings` (404 page)
40. ★ The full 404 page content was captured:
    - "404", 🔍 and the H1 "Halaman Tidak Dijumpai".
    - The text "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?".
    - The links "Halaman Utama" → `/` and **"Mula Latihan" → `/latih-tubi`, which itself returns 404 (a broken link)**.
    - The caption "PRESTASIPLUS" and the title "404 - Halaman Tidak Dijumpai | PRESTASIPLUS".
    - A standalone layout with no shell.

40a. ★ **Correction to the narrative:** it said "No link to `/settings` exists in either sidebar". In fact the **user-shell mobile drawer** (<1024) has **"Tetapan" → `/settings`** (EL-M01-SHU-315, next to "Profil Saya" and "Log Keluar"). On mobile that dead link leads to the 404 page. The desktop sidebar has only "Tetapan Peribadi" → `/tetapan`.

### S11 `/notifikasi`
41. ★ **Selection counter "`{n}` dipilih"** (x-text `selected.length + ' dipilih'`) is shown when ≥1 item is ticked. "Pilih Semua" ticks only the current page (20), giving "20 dipilih".
42. ★ While in select mode, the header actions ("Tanda semua dibaca" form and "Pilih") are **hidden** (`x-show="!selectMode"`), and each item's trash button is hidden.
43. ★ **"Pilih" is not rendered when the list is empty.** "Tanda semua dibaca" is still shown on empty filters.
44. Item click calls `markRead` only when not in select mode (`!selectMode && markRead($event, id)`). Deleted items are hidden on the client via `deletedIds` before the reload.
45. The trash button uses inline `onmouseenter`/`onmouseleave` opacity, so it appears **only when hovering the button itself**. On touch devices it is effectively invisible (defect).
46. ★ **Pagination:**
    - At ≥640 it shows the English Laravel text **"Showing 1 to 20 of 167 results"** plus numbered links 1…**9**, with chevron-only prev/next links. Their aria text is the double-escaped "&laquo; Previous" / "Next &raquo;".
    - Below 640 (mobile-only) it shows the simple English "« Previous" / "Next »".
    - Pagination links **keep the active filter** (for example `?filter=unread&page=2`).
47. The unread pill (166) and "Belum Dibaca (166)" differ from "Semua (167)". "Sudah Dibaca" has no count. The admin's `?filter=read` shows 1 item.
48. The admin's `type=system`, `type=reminder` and `type=milestone` filters all show the empty state, "Tiada notifikasi" / "Notifikasi baru akan muncul di sini".
49. ★ A third type code was observed: **`new_ticket`**, alongside `chatbot_new_conversation` and `spaced_review`. The codes are stored in lowercase and shown uppercase through CSS.
50. Icons:
    - "Tanda semua dibaca" uses `fa-check-double` and "Pilih" uses `fa-check-circle`.
    - The filters use `fa-cog` (Sistem), `fa-clock` (Peringatan) and `fa-trophy` (Pencapaian).
    - The bulk actions use `fa-check` (Tanda Dibaca) and `fa-trash` (Padam).
    - The item trash uses `fa-trash-alt` and the meta time uses `far fa-clock`.
51. The component is `notifInbox()`, with keys `selectMode`, `selectAll`, `selected`, `deletedIds` and `csrfToken`.

### Route probes (GET, no redirects followed)
52. These return **404**: `/password/confirm`, `/email/verify`, `/forgot-password`, `/reset-password/x`, `/two-factor-challenge`, `/user/profile`, `/profile/show`, `/profile/{id}`, `/tetapan/edit`, `/account/settings`, `/profil`, `/daftar`, `/log-masuk`, `/masuk`, `/guru/register`, `/register/guru`, `/register/teacher`, `/sponsor/login`, `/home`, `/api/user`, `/password/reset-ic/verify`, `/password/reset-ic/result`, `/latih-tubi`.
53. These return **405** (POST/DELETE only): `GET /profile/password`, `/profile/picture`, `/notifikasi/read-all`, `/notifikasi/{id}`, `/notifikasi/bulk-read`.
54. `GET /api/schools/search` is public (200 for guests). The response fields are `id, name, code, type, state, district, city`, as already documented.

**Total: 55 items (1–54 plus 40a) that were missing from, or wrong in, the narrative doc.**

## 3. New routes found by the crawl

The crawl covered 238 unique URLs (`_crawl.json`). **No new M01 screen was found.** These M01 URLs are not in the TRACKER M01 checklist; they are endpoints and form actions, not screens:

| URL | Kind | Found on | Note |
|---|---|---|---|
| `POST /password/email` | form action | S3 | Sends the reset link. In the narrative doc, not in the tracker |
| `POST /profile/picture` | form action (multipart) | S8 | Avatar upload |
| `POST /profile/password` | form action | S8 | Password change |
| `POST (PUT) /profile`, `POST (PUT) /tetapan` | form actions | S8, S9 | Tracker lists the GET routes only |
| `POST /notifikasi/read-all`, `POST /notifikasi/{id}/read`, `DELETE /notifikasi/{id}`, `POST /notifikasi/bulk-read`, `POST /notifikasi/bulk-delete`, `GET /notifikasi/unread-count` | form / JS endpoints | S11, shells | Shared with M22 |
| `GET /api/schools/search?q=&state=&limit=` | JS endpoint | S2, S8 | Owned by M02, used by M01 |
| `/notifikasi?filter=unread\|read`, `?type=system\|reminder\|milestone`, `?page=N`, `?filter=unread&page=N` | query variants | S11 | All captured as states |
| `/register?role=…`, `/register?ref=…` | probed query variants | — | Ignored by the page (item 9) |

**Unknown or unassigned URLs (not in any TRACKER module):**
- `/dashboard`: the user-portal home. It is linked from the shells ("Dashboard", "Home", "Ke Dashboard", "Student View"). **It is not in any module checklist.** Suggest adding it to M08 or M17, or creating an entry for it.
- `/latih-tubi`: linked from the 404 page, but it is itself a 404 (broken link; a fidelity deviation candidate).

## 4. Out-of-module links found (target module)

The shells link to about 200 routes across M02–M26. Every one is classified in `_crawl.json` (field `module`). By module: M02 6, M03 5, M04 9, M05 8, M06 7, M07 3, M08 7, M09 11, M10 17, M11 6, M12 15, M13 4, M14 15, M15 5, M16 10, M17 7, M18 12, M19 5, M20 3, M21 5, M22 8, M23 4, M24 6, M25 6, M26 4.

Found on M01 screens (not in the shells):
| URL | Found on | Target module |
|---|---|---|
| `/sponsor/register` | S2 "Daftar sebagai Penaja" | M21 (not in the M21 checklist) |
| `/` | S1, S2, S10 | Public landing page (out of scope) |
| `/admin` | post-login landing | M17 |
| `/api/tournament/active`, `/tournament/{id}` | S7, S8, S11 (tournament banner) | M16 |
| `/chatbot/history`, `/chatbot/send`, `/chatbot/rate` | shells (chatbot widget) | M22 |
| `/fcm/token` | shells (push registration) | M22 |
| `/admin/server-status` | S9 (admin header) | M23 |

URLs from the shells that are in the TRACKER only as relative entries (M12 `…/reaction`, `…/learning`, `…/behavior`, `…/results`, `…/chain`, `…/interventions`) resolve to `/admin/kirkpatrick/*` and `/guru/kirkpatrick/*`. Both families are linked.

Global strings found in the shells are for the global UI doc, not M01:
- the PWA prompt "Tekan Pasang untuk arahan pemasangan";
- the chatbot strings "Maaf, berlaku ralat. Sila cuba semula.", "Sila masukkan maklumat anda sebelum memulakan perbualan." and the quick questions "Apakah PrestasiPlus?", "Bagaimana cara mendaftar?", "Berapakah harga langganan?";
- the service-worker and FCM console strings.

## 5. What could not be revealed (read-only limits)

| Item | Why |
|---|---|
| Server responses after submit for login (other than the documented invalid-credentials alert), register, `/password/email`, `/password/reset`, `/password/reset-ic`, profile save, picture upload, password change, `/tetapan` save, mark read, bulk read/delete, read-all | Submitting would change data or send email. The loading states were simulated on the client instead (`loading=true`) |
| The `bulkDelete()` / `deleteSingle()` confirm dialogs | Only reachable by clicking Padam. Their text was taken from the page script instead ("Padam notifikasi ini?", "Padam {n} notifikasi yang dipilih?") |
| An item after `markRead` (the read style) | Clicking an item marks it read. The read style is taken from the `filter=read` item and the markup |
| Notifications of types system, reminder and milestone | The admin has none. Only the empty state was captured |
| The tournament banner in its visible state | No active tournament. Its `x-if` templates were captured as hidden-only |
| Student, teacher and parent views of `/profile` ("Statistik & Pencapaian") and the non-admin landing pages | Only an admin account is available |
| HTML5 native validation bubbles | These are browser UI, not DOM. The messages are as in the narrative doc (browser default, English) |
| The picture-upload preview with a real image | Simulated by un-hiding `#uploadBtn`. No file was chosen, so nothing could be uploaded |
