# M02 — Element inventory & link crawl: summary

- **Captured:** 2026-09-25, live https://prestasiplus.my, read-only, admin session.
- **Method:** same pipeline as M01 (`tools/inventory.js` → `tools/run-state.js` → `tools/split-batch.js` → `tools/merge-inventory.js` → `tools/diff-narrative.js`). Capture plan: `tools/jobs/M02.js` (139 UI states over 16 screens, groups A–J); screen map: `tools/jobs/M02.screens.json`; masked screenshots: `tools/jobs/M02.shots.js` + `tools/shoot.js` (40 PNG in `docs/discovery/img/M02/`).
- **Privacy (new for M02):** every job runs `tools/sanitize.js` in the page **before** the inventory/screenshot. It masks personal table columns (Nama, Emel, Telefon, IC, Username, Cikgu …), person pickers (teacher select: 551 options → `<person> (<email>)`), detail label/values, Alpine `x-text` name/email bindings, Alpine data, inline-script JSON, detail-page titles, and replaces person-record ids with `{id}` (URL rewritten with `history.replaceState`). The individual student's school/class on S3 and S8 is masked too (school–student association). `run-state.js` records `meta.piiLeakCheck` per state: **0 leaks in all 139 states**. A regex sweep of all raw/merged files for Malay name patterns (bin/binti/a/p/a/l), emails, IC and phone formats found only the UI's own sample strings ("Muhammad Fulan bin Fulan" (privacy replacement, 2026-09-30), "contoh@email.com", "031215101234", "0191234567").
- **Redaction:** the UI's fixed default passwords are stored as `<default-password>` / `<default-password-A>` (and `<digits:8>` for the comp-student password); see narrative F1.
- **Files:** `S1-users.json` … `S16-user-packages.json`; `SHA-admin-shell.json` (layout chrome, owned by the global doc/M23); `_crawl.json`; raw captures `../_raw/M02/*.json` (139).
- **Status legend:** as M01 (`visible-default`, `conditional`, `hidden-only`, `mobile-only`, `desktop-only`). `normalizeIds` merges list rows/paginator links across filtered states; `repeatCount` marks collapsed data rows.

## 1. Per-screen counts

M02 content totals **1,056 elements** over 16 screens and **139** captured states (1280 / 768 / 375). The admin shell adds 247 elements (chrome, not M02 content).

| Screen (route) | Total | Visible default | Conditional | Hidden only | Mobile only | Desktop only | States | States captured |
|---|---|---|---|---|---|---|---|---|
| S1-users `/admin/users` | 149 | 68 | 43 | 38 | 2 | 18 | 17 | default, role-student, role-parent, role-school_admin, role-jpn_officer, inactive, school-filter, search-empty, page-2, page-last, select-one, select-all, delete-modal, bulk-delete-modal (@1280); default@375, select-one@375, default@768 |
| S2-users-create `/admin/users/create` | 156 | 6 | 94 | 56 | 0 | 0 | 22 | default, role-{student,teacher,parent,sponsor,school_admin,ppd_officer,jpn_officer,admin}, sa-search, sa-search-empty, sa-generated, ppd-jpn-selected, jpn-jpn-selected, parent-search, parent-linked, std-school-search, std-school-selected (@1280); default@375, role-student@375, role-school_admin@375, role-student@768 |
| S3-users-edit `/admin/users/{id}/edit` | 116 | 56 | 37 | 23 | 0 | 0 | 13 | student: default, password-open, school-search, school-state, school-empty, role-teacher; parent: default, search, search-empty, role-student (@1280); default@375, parent@375, default@768 |
| S4-bulk-import `/admin/users/bulk-import` | 56 | 37 | 10 | 9 | 0 | 0 | 12 | default, mode-csv, role-{teacher,parent,school_admin,ppd_officer}, school-search, school-search-empty, school-selected (@1280); default@375, mode-csv@375, default@768 |
| S5-import-students `/admin/import-students` | 132 | 55 | 26 | 51 | 0 | 0 | 12 | default, mode-csv, class-t5, school-search, school-search-empty, school-state, school-subscribed, school-students, school-nosub-sk (@1280); default@375, school-subscribed@375, default@768 |
| S6-comp-students `/admin/comp-students` | 32 | 20 | 9 | 3 | 2 | 7 | 7 | default, select-one, select-all, page-2 (@1280); default@375, select-one@375, default@768 |
| S7-comp-create `/admin/comp-students/create` | 17 | 15 | 1 | 1 | 0 | 0 | 5 | default, teacher-classes, teacher-noclass (@1280); default@375, default@768 |
| S8-comp-show `/admin/comp-students/{id}` | 27 | 25 | 0 | 2 | 0 | 0 | 3 | default @1280/375/768 |
| S9-schools `/admin/schools` | 63 | 51 | 7 | 5 | 2 | 18 | 9 | default, state-perlis, type-sk, search, search-empty, page-2, page-last (@1280); default@375, default@768 |
| S10-schools-create `/admin/schools/create` | 21 | 18 | 0 | 3 | 0 | 0 | 3 | default @1280/375/768 |
| S11-schools-edit `/admin/schools/{id}/edit` | 22 | 18 | 0 | 4 | 0 | 0 | 2 | default @1280/375 |
| S12-subscriptions `/admin/school-subscriptions` | 39 | 33 | 6 | 0 | 0 | 0 | 9 | default, status-{active,grace,expired,cancelled}, form-t4, search-empty (@1280); default@375, default@768 |
| S13-subscriptions-create `/admin/school-subscriptions/create` | 52 | 24 | 14 | 14 | 0 | 0 | 9 | default, tier-full, package-t5, full-package-t4, school-search, school-search-empty, school-selected (@1280); default@375, default@768 |
| S14-subscription-show `/admin/school-subscriptions/{id}` | 105 | 44 | 54 | 7 | 2 | 8 | 10 | basic: default, adjust-open, upgrade-open, extend-open, page-2, per-page-25; full: overquota, adjust-open (@1280); default@375, default@768 |
| S15-renewal-invoice `/admin/school-subscriptions/{id}/renewal-invoice` | 36 | 30 | 6 | 0 | 0 | 0 | 3 | basic@1280, full@1280, default@375 |
| S16-user-packages `/admin/users/{id}/packages` | 33 | 27 | 0 | 6 | 0 | 0 | 3 | default @1280/375/768 |
| SHA-admin-shell (chrome of all M02 screens) | 247 | 84 | 58 | 105 | 7 | 79 | 136 | all shell states |

Empty states captured: S1 "Tiada pengguna dijumpai", S9 "Tiada sekolah dijumpai", S12 "Tiada langganan dijumpai." (search=zzqxv), plus picker empties "Tiada sekolah dijumpai" / "Tiada pelajar dijumpai" (S2–S5, S13) and "Guru ini tiada kelas aktif." (S7). The S6 empty row ("Tiada pelajar komplimen lagi. Daftar baru.") was read from `?page=99`.

## 2. Not in the narrative discovery

`node tools/diff-narrative.js inventory/M02 docs/discovery/M02-users-schools.md` → **0 candidates on all 16 screens** (after reconciliation; Appendix A of the narrative lists concatenated DOM strings and live data values). Items found only by the inventory/state captures during reconciliation and now in the narrative:
1. S1 "Pakej" action (`/admin/users/{id}/packages`) exists only on school-admin rows → new screen S16.
2. S1 `jpn_officer` badge shows the raw code; JPN officers missing from filter/cards/edit select (D-2, D-3).
3. S2 "Daftar Pengguna" disabled for school admins until credentials are generated; "Sekolah ini tiada kod KPM…" warning; "Disalin!" toast.
4. S3 role sections are server-fixed (non-reactive x-show, D-4); student edit has an individual "Pakej Langganan" block (subscription_package + PKSK).
5. S5 class levels switch on `type === 'SK'`; quota panel texts; existing-students list (200 cap); "Kembali" goes to `/admin`.
6. S6 comp table is clipped by `overflow-hidden` (D-5); bulk actions have no confirmation.
7. S13 live price summary ("Jumlah `n` tahun"), package years = `max_renewals + 1`.
8. S14 upgrade copy says "80 soalan/bulan" vs 500 / 99999 elsewhere (D-7); quota max 2000 vs 5000 on S16 (D-8).
9. IC inputs carry `inputmode=numeric` (S2/S3).

## 3. New routes found by the crawl

291 unique URLs (`_crawl.json`). Not in the TRACKER M02 checklist:

| URL | Kind | Found on | Note |
|---|---|---|---|
| `/admin/users/create` | screen | S1 | S2 |
| `/admin/users/{id}/edit` | screen | S1 | S3 |
| **`/admin/users/{id}/packages`** | screen + POST | S1 (school_admin rows) | S16 "Assign Pakej SPM" |
| `/admin/comp-students/create`, `/admin/comp-students/{id}` | screens | S6 | S7, S8 |
| `/admin/schools/create`, `/admin/schools/{id}/edit` | screens | S9 | S10, S11 |
| `/admin/school-subscriptions/create`, `/admin/school-subscriptions/{id}` | screens | S12 | S13, S14 |
| **`/admin/school-subscriptions/{id}/renewal-invoice`** | standalone print page | S14 | S15 |
| `POST /admin/users/{id}/toggle-active`, `/impersonate`, `DELETE/PUT /admin/users/{id}`, `POST /admin/users/bulk-destroy` | form actions | S1, S3 | |
| `POST /admin/comp-students/bulk-action`, `/{id}/toggle-coins`, `/{id}/toggle-active` | form actions | S6, S8 | |
| `POST /admin/schools/{id}/toggle`, `PUT /admin/schools/{id}` | form actions | S9, S11 | |
| `PUT …/{id}/quota`, `POST …/{id}/extend`, `…/upgrade`, `…/cancel` | form actions | S14 | |
| `GET /admin/api/schools/{id}/quota`, `/admin/api/schools/{id}/students` | JSON | S5 | |
| `GET /admin/comp-students/teacher/{id}/classrooms` | JSON | S7 | |
| `GET /api/students/search`, `/api/jpn`, `/api/jpn/{id}/ppd` | JSON | S2, S3 | `/ppd` in the crawl is the tail of the JS concatenation `'/api/jpn/' + id + '/ppd'` |
| `GET /api/schools/search` (`q`, `state`, `limit`, `id`) | JSON | S2–S5, S13 | first seen in M01 |
| `GET /admin/import-students/template` | xlsx | **probe only, unlinked** | see §5 |
| Query variants: `/admin/users?role=&school=&is_active=&search=&page=`, `/admin/schools?search=&state=&type=&page=`, `/admin/school-subscriptions?search=&status=&form_level=`, `/admin/school-subscriptions/{id}?per_page=&page=`, `/admin/comp-students?page=` | | | all captured as states |

Probed, absent: `/admin/users/{id}` and `/admin/schools/{id}` (405, no show pages), `/admin/comp-students/{id}/edit`, `/admin/school-subscriptions/{id}/edit`, `/admin/users/bulk-import/template`, `/admin/import-students/history`, `/admin/comp-students/export` (404).

## 4. Out-of-module links (target module)

From the admin shell (sidebar/header) on the M02 screens, classified in `_crawl.json`: M01 2, M03 3, M04 6, M05 1, M06 6, M07 2, M09 5, M12 8, M14 8, M15 1, M16 5, M17 7, M19 3, M20 2, M21 3, M22 2, M23 3, M24 6, M25 6, M26 4 (unknown 0).

Found in M02 content (not the shell):
| URL | Found on | Target |
|---|---|---|
| `/admin` | S5 "Kembali" | M17 |
| `/admin/server-status` | every screen (header widget script) | M23 |
| Student packages on S3 (`subscription_package`, PKSK) | S3 | M19 / M07 (fields posted to the M02 user update) |
| Subscriptions/invoice (S12–S15) | — | shared with M19 (finance); kept in M02 per TRACKER |

## 5. What could not be revealed read-only / safety notes

| Item | Why |
|---|---|
| All POST outcomes and flash/validation messages (create/update/delete/toggle users, impersonate, bulk delete, both imports, comp-student create/bulk/toggles, school save/toggle, subscription create/quota/extend/upgrade/cancel, S16 package assignment) | Would change data. Confirm texts were read from the DOM. |
| "Login As" session view | Impersonation changes the session; not triggered. |
| Cancelled / expired / grace subscription detail pages; "Tempoh Ihsan" badge | Only 2 subscription detail pages allowed; both opened were active. |
| Toggled labels (S8 "Matikan syiling"/"Aktifkan akaun", S9 `fa-toggle-off` "Aktifkan") | Only reachable by toggling or on an inactive record not opened. |
| Import file processing and result screens | Upload is forbidden; no file was chosen. |
| `template-import-pelajar.xlsx` content | **Safety note:** while probing candidate URLs with `fetch`, `GET /admin/import-students/template` returned the xlsx template (content-type + `attachment` filename recorded). The body was received into browser memory only, never saved or opened, and it is a blank template (not personal data). The brief said to record such URLs without downloading; subsequent probes avoided download routes. |
| Parent-portal / student view of links and packages | Only the admin account is available. |

## 6. Tool changes (backward compatible with M01)

- **New** `tools/sanitize.js` — in-page personal-data scrubber (opt-in per job via `job.sanitize`).
- **New** `tools/shoot.js` — masked screenshot runner reading `window.__shots`.
- `tools/run-state.js` — if `job.sanitize` is set, injects `sanitize.js` after the actions and adds `meta.piiLeakCheck`; unchanged for M01 jobs (no `sanitize` key).
- `tools/merge-inventory.js` — optional `normalizeIds` (id/count/paginator normalisation for list screens) and `collapseKeys` (regex list of keys collapsed like data rows) in `screens.json`; both off unless configured (M01 config has neither).
- `tools/diff-narrative.js` — ignores strings made only of placeholders (e.g. `<person> (<email>)`); this can only remove candidates, never add them.
