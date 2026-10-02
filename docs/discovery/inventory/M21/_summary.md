# M21 — Element inventory & link crawl: summary

- **Captured:** 2026-09-27 (05:19–05:40 and 10:14–10:40 MYT; paused by an API rate limit in between) from live https://prestasiplus.my, read-only, admin session on browser lane 1 (`playwright`) plus one cookie-less guest context. Credentials are not stored.
- **Method:** the standard pipeline: `tools/inventory.js` → `tools/run-state.js` → `tools/split-batch.js` → `tools/merge-inventory.js` → `tools/diff-narrative.js`. **No shared tool was modified.**
  - **Write guard:** `tools/jobs/M21-guard.js`, installed on every browser context before any capture, and re-installed and re-probed after the pause (before the new login). It aborts every non-GET / HEAD / OPTIONS request except `POST /login`, every payment-gateway host, every download / export navigation and every write-shaped GET (approve / lulus / reject / tolak / suspend / activate / aktifkan / toggle / delete / assign / taja / bayar / whatsapp / redirect / logout …). Probes (both installs): `POST` and `DELETE /__m21_probe`, `GET /admin/sponsors/__m21_probe/approve`, `GET /admin/anak-angkat/__m21_probe/toggle`, `GET /__m21_probe/whatsapp`, `GET /logout` — all blocked. Otherwise only Cloudflare RUM beacons (`POST /cdn-cgi/rum`) were blocked. No application write was attempted.
  - **Detail-page cache (same file):** every document / fetch GET of an M21 path reaches the server once per context; later requests are fulfilled from memory. 80 M21 URLs were cached; none was requested twice. No M21 page shows a counter.
  - **Capture plan:** `tools/jobs/M21.js`, 55 UI states over 7 screens in groups A–H (H = guest). Two guest states of S1 / S6 were dropped from the inventory because they are the M01 login page (302); the redirects are recorded in the crawl and narrative §1.
  - **Screen map:** `tools/jobs/M21.screens.json`. Classification rules: M21 = `/admin/sponsors*`, `/admin/anak-angkat*`, `/mohon-keluarga-angkat*`, `/sponsor*`, guessed `/penaja*`, `/anak-angkat*`, `/keluarga-angkat*`, `/admin/sponsor`, `/admin/penaja`.
  - **Crawl:** `tools/jobs/M21-crawl.js` (structure only; 80 URLs incl. 46 probes); supplement `tools/jobs/M21-crawl-post.js`.
  - **Seed snapshot:** `tools/jobs/M21-snapshot.js` → `_snapshot-2026-09-27.json` (includes the layout measurements and the side-effect ledger).
  - **Responsive measurements:** `tools/jobs/M21-measure.js` (7 routes × 375 / 768 / 1280).
  - **Masked screenshots:** `tools/shoot.js` with `tools/jobs/M21.shots.js` (32 PNGs in `docs/discovery/img/M21/`).
- **Privacy:**
  - Personal data on these pages: the sponsor contact officer (S1 "Pegawai", S3 contact / address fields), the sponsor user e-mails (S1 "Organisasi" second line), the adopted student (S4), the 3 applicant students and 1 parent applicant (S5), and the parent-written application reason (S5 "Sebab").
  - Each job ends with `M21MASK` (e-mail / phone / BIN-BINTI leaves; the Pelajar / Pemohon / Pegawai / Penaja / Sebab table columns; contact / address / registration inputs blanked), then `tools/sanitize.js` with `{selectors:['.m21n'], titleName:false, keepSelects:'student_category|family_income_range|channel'}`. `keepSelects` was added after the first pass, which had masked the B40 / Asnaf / Yatim / OKU / Lain-lain options (sanitize treats `student_*` selects as person pickers); groups D and F were re-captured.
  - `piiLeakCheck` = **0 leaks in all 55 states**. A scripted scan of every M21 file for the observed personal strings finds 0 hits. The screenshots were checked by eye (S1, S4, S5 show `<person>` / `<masked>` / `<phone>`).
  - E-mails are Cloudflare-protected (`__cf_email__`) in raw HTML; the snapshot stores presence flags only. Application reasons are stored only as length + "equals site example n".
  - **Over-masking (not personal data):** S4 "Penaja" column (organisation) → `<person>`; the S3 input `name` (organisation) blank and subtitle `<name>`; the S6 list item "Guru / Kaunselor — mohon untuk pelajar yang dikenal pasti memerlukan" → `<person>` (sanitize masks the node after the label "Ibu bapa"). Real copy is in the narrative / snapshot.
  - No unmasked dump was written. The only scratch file (structural crawl, `scratchpad/m21/crawl-struct.json`) was deleted after use.
- **Windows file-name note:** the job keys `status-PENDING` / `status-SUSPENDED` collided with `status-pending` / `status-suspended` on the case-insensitive file system; they were renamed `status-pending-uc` / `status-suspended-uc` and the lower-case states re-captured.
- **Files:** `S1-admin-sponsors.json` … `S7-sponsor-register.json`, layout chrome `SHA-admin-shell.json` (S1–S5) and `SHU-user-shell.json` (S6), `_crawl.json`, `_snapshot-2026-09-27.json`; raw captures `../_raw/M21/*.json` (55).
- **Status legend:** as M01–M20; `normalizeIds` on. Table rows are sampled with `opts.repeat` (`main tbody tr`, 3 samples; totals in `meta.repeats`). Table body text is not inventoried; row data is in the snapshot (masked).

## 1. Per-screen counts

M21 content totals **345 elements** over 7 screens and **55** captured states (1280 / 768 / 375). The shells add 217 (SHA) and 372 (SHU) chrome elements, which are not M21 content.

| Screen (route) | Total | Visible default | Conditional | Hidden only | States | States captured |
|---|---|---|---|---|---|---|
| S1-admin-sponsors `/admin/sponsors` | 46 | 37 | 7 | 2 | 14 | default, status-{pending, approved, rejected, suspended, pending-uc, suspended-uc}, cat-{individu, swasta}, search-{match, none}, page-2 (@1280); default @375/@768 |
| S2-admin-sponsor-create `/admin/sponsors/create` | 38 | 37 | 0 | 1 | 3 | default @1280/@375/@768 |
| S3-admin-sponsor-edit `/admin/sponsors/{id}/edit` | 64 | 49 | 12 | 3 | 6 | #6 (default), #11 with-officer, not-found 404, show-500 (@1280); default @375/@768 |
| S4-admin-anak-angkat `/admin/anak-angkat` | 50 | 38 | 4 | 8 | 9 | default, status-{all, active, graduated, withdrawn, expired}, show-405 (@1280); default @375/@768 |
| S5-admin-permohonan `/admin/anak-angkat/permohonan` | 37 | 24 | 7 | 6 | 8 | default, status-{pending, approved, matched, rejected}, not-found (@1280); default @375/@768 |
| S6-mohon-keluarga-angkat `/mohon-keluarga-angkat` | 38 | 34 | 0 | 4 | 4 | default, example-2 (@1280); default @375/@768 |
| S7-sponsor-register `/sponsor/register` | 72 | 35 | 33 | 4 | 11 | default, tile, step-2, step-3, step-3-eye, guest (@1280); default, step-2, step-3, guest @375; default @768 |
| SHA-admin-shell (chrome of S1–S5) | 217 | 75 | 24 | 118 | 36 | all SHA states |
| SHU-user-shell (chrome of S6) | 372 | 152 | 15 | 205 | 4 | all SHU states |

**Horizontal page overflow at 375:** S3 (status card, scrollWidth 409) and S4 (status tabs, 397). None at 768 / 1280.

**Text under 12 px:** S1 table 9–10 px at 375 (73); S4 10 px (7, all widths); S5 10 px (18, all widths); S6 10 px (1); S7 10 px tile labels at 375 (20).

**Empty / error states captured:** S1 "Tiada penaja dijumpai" (+ page-2 pager), S4 "Tiada rekod", S5 "Tiada permohonan approved / matched / rejected"; 404 (S3, S5), 500 "Ralat Pelayan" (S3 show), Symfony 405 (S4).

## 2. Link crawl (`_crawl.json`)

304 URLs classified; **106 are M21**:
- 34 pages opened with HTTP 200 (list / filter / tab variants, create, 6 edit pages, S6, S7);
- 46 probes: 403 × 4 (sponsor portal), 404 × 35, 405 × 5, 500 × 2 (sponsor "Lihat");
- 26 form actions / endpoints from page code (never submitted / called).

The rest are shell links classified to their owning modules (M01–M26). Unknown (1): `/` (site root link of the error pages and S7).

**New routes (not in TRACKER before this run):**
- pages: `/admin/sponsors/create`, `/admin/sponsors/{id}/edit`;
- role-gated sponsor portal (403 for admin, 302 `/login` for guest): `/sponsor`, `/sponsor/anak-angkat`, `/sponsor/anak-angkat/pool`, `/sponsor/rewards`; POST-only `/sponsor/profile` (GET 405);
- broken: `GET /admin/sponsors/{id}` → 500;
- write endpoints (never submitted): `POST /admin/sponsors`, `PUT /admin/sponsors/{id}`, `POST /admin/sponsors/{id}/reactivate`, `POST /admin/anak-angkat/assign`, `POST /admin/anak-angkat/{id}/status`, `POST /admin/anak-angkat/permohonan/{id}/lulus`, `POST /admin/anak-angkat/permohonan/{id}/tolak`, `POST /mohon-keluarga-angkat`, `POST /sponsor/register`;
- JSON (never called): `GET /admin/anak-angkat/cari-pelajar?q=`.

**Probed:** see narrative §1 (403 / 404 / 405 / 500 lists) and guest redirects (S1, S2, S4, S5, S6, sponsor portal → `/login`; S7 public).

**Owned elsewhere:** sponsor user accounts, students, parent → M02; M17 dashboard sponsor cards (provisional store) → M17; M01 / M08 links to S7; `/register`, `/login` → M01.

## 3. Reconciliation

`node tools/diff-narrative.js inventory/M21 M21-sponsorship.md` → **0 candidates on every screen** (S1–S7).

## 4. Read-only limits (not revealed)

- Sponsor portal content and the sponsor landing page (403 for admin; no active sponsor account).
- Admin actions for PENDING / APPROVED / REJECTED sponsors (all 6 suspended).
- Flash / validation messages after every write; S7 success page.
- S4 student-search dropdown results (typing would return real students).
- Rows in graduated / withdrawn / expired and approved / matched / rejected states; full application reason view.
- "Hadiah" count source (M15), free-access grant (M19), "Via Agent" (M24); pagination size.

See narrative §9.
