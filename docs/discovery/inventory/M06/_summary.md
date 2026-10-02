# M06 — Element inventory & link crawl: summary

- **Captured:** 2026-09-25 from live https://prestasiplus.my, read-only, admin session on browser lane 3 (`playwright3`, own login; credentials not stored).
- **Method:** the same pipeline as M01–M04: `tools/inventory.js` → `tools/run-state.js` → `tools/split-batch.js` → `tools/merge-inventory.js` → `tools/diff-narrative.js`.
  - Capture plan: `tools/jobs/M06.js`, 72 UI states over 13 screens in groups A–H.
  - Screen map: `tools/jobs/M06.screens.json`.
  - Masked screenshots: `tools/jobs/M06.shots.js` + `tools/shoot.js`, 34 PNGs in `docs/discovery/img/M06/`.
  - Appendix generator: `tools/jobs/M06-appendix.js` (copy of the M04 helper, de-duplicated across screens).
  - **No shared tool was modified.**
- **Privacy:**
  - Every job first runs `M06MASK` (in `tools/jobs/M06.js`), then `tools/sanitize.js`. `M06MASK` masks the Duta recommendation card (name, avatar initials, `/bilik-duta/<slug>`) and the author · school line of structured sets (`fa-user-pen`).
  - `meta.piiLeakCheck` is 0 leaks in all 72 states.
  - A grep of all raw and merged M06 files, the narrative and the job files for the real names seen during discovery, `bin`/`binti` patterns and e-mail patterns found **no matches**.
  - Question text is kept as data samples.
- **Files:**
  - Screen inventories: `S1-spm-hub.json` … `S13-walkthrough.json`.
  - Layout chrome: `SHU-user-shell.json` (user portal, S1–S10) and `SHA-admin-shell.json` (admin panel, S11–S13). Both are owned by the global doc.
  - `_crawl.json`.
  - Raw captures: `../_raw/M06/*.json` (72).
- **Status legend:** same as M01–M04. `normalizeIds` is on. Structured-set cards (`main .grid > .card`) and mock review items (`main .q-review`) are limited to the first 3 per list via `opts.repeat`; the totals are in each state's `meta.repeats`. All subject cards (S2, S3, S5, S8) and all set cards (S6) are kept.

## 1. Per-screen counts

M06 content totals **1,315 elements** over 13 screens and **72** captured states (1280 / 768 / 375). The shells add 378 (user portal) and 196 (admin) chrome elements, which are not M06 content. **No captured state has horizontal page overflow**; overflow inside components is described in narrative §7.

| Screen (route) | Total | Visible default | Conditional | Hidden only | Mobile only | Desktop only | States | States captured |
|---|---|---|---|---|---|---|---|---|
| S1-spm-hub `/spm` | 43 | 40 | 0 | 3 | 0 | 0 | 3 | default @1280/375/768 |
| S2-databank `/spm/tahun-lepas` | 168 | 165 | 0 | 3 | 0 | 0 | 3 | default @1280/375/768 |
| S3-latih-tubi `/spm/latih-tubi` | 86 | 83 | 0 | 3 | 0 | 0 | 3 | default @1280/375/768 |
| S4-latih-tubi-subject `/spm/latih-tubi/{CODE}` | 67 | 19 | 44 | 4 | 0 | 0 | 13 | default (MATH), level-t4, level-t5-sukar, level-toggle-off, custom-bm, latihan-addmath, free-count (PERNIAGA), free-count-30, hub-locked-ba, not-found (@1280); default@375, free-count@375, default@768 |
| S5-tracking-a `/spm/ramalan` | 269 | 266 | 0 | 3 | 0 | 0 | 3 | default @1280/375/768 |
| S6-tracking-a-subject `/spm/ramalan/{CODE}` | 123 | 31 | 89 | 3 | 0 | 0 | 8 | default (GEO), all-locked-math, clean-akaun, mixed-psi, empty-ba, not-found (@1280); default@375, default@768 |
| S7-tracking-bahasa `/latihan-berstruktur?…&scope=spm&track=bahasa` | 119 | 69 | 44 | 6 | 2 | 18 | 7 | default (BM), bi-redirect, all-subjects, kbat-6, page-2 (@1280); default@375, default@768 |
| S8-subjektif `/spm/subjektif` | 150 | 87 | 60 | 3 | 0 | 0 | 6 | default (Semua), tab-core, tab-elective (@1280); default@375, tab-core@375, default@768 |
| S9-subjektif-list `/latihan-berstruktur?subject_id=&scope=spm` | 125 | 61 | 59 | 5 | 2 | 18 | 7 | default (MATH), all-subjects, sains-komputer, kbat-6, page-2 (@1280); default@375, default@768 |
| S10-history `/spm/history` | 49 | 42 | 4 | 3 | 0 | 0 | 7 | default, past-year, latih-tubi, tracking-a-empty (@1280); default@375, tracking-a-empty@375, default@768 |
| S11-mock `/spm-mock` | 31 | 30 | 0 | 1 | 0 | 0 | 4 | default, selected (NOT submitted) (@1280); default@375, default@768 |
| S12-mock-result `/spm-mock/{id}/result` | 64 | 54 | 10 | 0 | 0 | 0 | 4 | default (mock 16), not-found (@1280); default@375, default@768 |
| S13-walkthrough `/pusat-ai/spm` | 21 | 19 | 0 | 2 | 0 | 0 | 4 | default, subject (NOT submitted) (@1280); default@375, default@768 |
| SHU-user-shell (chrome of S1–S10) | 378 | 153 | 21 | 204 | 15 | 148 | 58 | all user-portal states |
| SHA-admin-shell (chrome of S11–S13) | 196 | 75 | 8 | 113 | 7 | 70 | 11 | all admin-layout states |

Mobile-only / desktop-only items on S7 and S9 are the Laravel paginator ("« Previous" / "Next »" below sm; numbered links and "Showing … results" from sm).

**Empty / error states captured:**
- S6 "Belum Ada Set Tracking A" / "Set Tracking A untuk subjek ini akan ditambah tidak lama lagi." (`/spm/ramalan/BA`).
- S10 "Belum Ada Sejarah" / "Mulakan kuiz SPM untuk melihat sejarah prestasi anda di sini." + "Mula Kuiz SPM".
- S9 empty grid (`kbat_level=6` on Matematik).
- 404 page "Halaman Tidak Dijumpai" for unknown subject codes (S4, S6) and unknown mock id (S12).
- S3 locked subject card (BA "Locked: 0/40"); S6 locked sets "Belum Cukup".

## 2. Not in the narrative discovery

`node tools/diff-narrative.js inventory/M06 docs/discovery/M06-spm.md` reports **0 candidates on all 13 screens**. The not-in-narrative list is **empty**.

Appendix B of the narrative holds the remaining exact DOM strings, data samples and shared-layout inline-script strings (generated by `tools/jobs/M06-appendix.js`); Appendix A holds the enumerations (Latih Tubi configuration of all 19 subjects, Tracking A readiness, set lists).

Items that only the inventory and state captures surfaced during reconciliation, all now in the narrative:
1. S4 difficulty buttons read keys 2–5 while data keys are 1–4 ("Sangat Sukar" always 0) (D-2).
2. S4 is reachable and startable for BA although S3 shows it locked with 0 questions (D-1).
3. S6 PSI lists its clean Set 4 first; MATH has 11 locked sets reachable by URL only.
4. `/spm/ramalan/BM` and `/BI` redirect to the Tracking A Bahasa list (S7).
5. S12 shows 27 review items for a 30-mark paper; the Duta recommendation changes per request.
6. S13 hidden result card "✨ Walkthrough Cikgu Alesa" and hidden file input (`accept="image/*"`).
7. S8 active tab unreadable (D-15).

## 3. New routes found by the crawl

420 unique URLs in `_crawl.json`: 127 M06, 103 M05 (the `/latihan-berstruktur` SPM lists, their pages and `jawab` links), 182 in other modules via the shells, and 8 unknown.

Not yet in the TRACKER M06 checklist:

| URL | Kind | Found on | Note |
|---|---|---|---|
| `/spm/history` (`?type=past_year\|latih_tubi\|ramalan`) | screen | S1, S10 | S10 "Sejarah Kuiz SPM" |
| `/spm/latih-tubi/{CODE}` (19 codes) | screen | S3 | S4 "Tetapan Kuiz"; 404 on unknown code |
| `/spm/latih-tubi/{CODE}/quiz?count=&level=&difficulty=` | session start | S4 | **not opened** |
| `/spm/tahun-lepas/{CODE}/quiz?count={5,10,20}` (18 codes) | session start | S2 | **not opened** |
| `/spm/ramalan/{CODE}` | screen | S5 | S6; BM/BI redirect to S7; 404 on unknown code |
| `/spm/ramalan/{CODE}?year=2026&set={n}` | session start | S6 | **not opened** (GEO 1, AKAUN 1–16, PSI 4) |
| `/latihan-berstruktur?subject_id={1\|2}&scope=spm&track=bahasa` | screen (M05 route) | S5 | S7 Tracking A Bahasa |
| `/latihan-berstruktur?subject_id={id}&scope=spm` | screen (M05 route) | S8 | S9 Subjektif SPM |
| `/latihan-berstruktur/{id}/jawab?scope=spm[&track=bahasa]` | session (M05) | S7, S9 | **not opened** |
| `POST /spm-mock/jana` | form | S11 | **not submitted** |
| `/spm-mock/{id}` | session (in progress, "Sambung →") | S11 | **not opened** (`/spm-mock/317`) |
| `/spm-mock/{id}/result` | screen | S11 | S12 (`/spm-mock/16/result`); 404 on unknown id |
| `POST /pusat-ai/spm/solve` | JSON | S13 script | **not called** |

**Unknown in the crawl:**
- `/`: the 404 page's "Halaman Utama" link.
- `/latih-tubi`: the 404 page's "Mula Latihan" link — itself a 404 (D-8).
- `/pusat-nota-ringkas`: mock result links "jana nota ringkas" / "📚 Belajar Topik Lemah" (notes centre, likely M25).
- `/api/tournament/active`: user-layout tournament banner (M16).
- `/chatbot/history`, `/chatbot/rate`, `/chatbot/send`, `/fcm/token`: user-layout widgets.

## 4. Out-of-module links (target module)

Found in M06 content (not the shell):

| URL | Found on | Target |
|---|---|---|
| `/latihan-berstruktur…` lists, pages and `jawab` links | S5, S7, S8, S9 | M05 |
| `/bilik-duta/{slug}` (Duta / Maestro card) | S11, S12, S13 | M24 |
| `/pusat-nota-ringkas` | S12 | M25 (unknown in TRACKER) |
| `/admin/server-status`, `/notifikasi/unread-count` | layout scripts | M23 / M22 |

No premium gating element (PRO badge, package upsell, PKSK link) appeared on any M06 screen for the admin account (narrative §8 Q2).

## 5. What could not be revealed read-only / safety notes

| Item | Why |
|---|---|
| All quiz pages and results: Databank, Latih Tubi, Tracking A sets, Tracking A Bahasa and Subjektif answer pages, their marking and results | Opening the start URLs may create session records; not approved. Listed in narrative §9 (L-1 … L-7). |
| Mock generation, in-exam UI, submit, other grades, monthly limit | `POST /spm-mock/jana` and `/spm-mock/{id}` not opened (L-8 … L-10). |
| Walkthrough result / errors | `POST /pusat-ai/spm/solve` not called (L-11). |
| Student-role view (gating, readiness panel) | Admin account only (L-13). |
| History rows of type Tracking A, other accuracy colours | No such data on the account (L-12). |

**Safety notes:**
- No quiz, practice, mock exam or walkthrough session was started. No `/quiz`, `/jawab`, `/start`, `/mula`, `/spm-mock/{id}` or `/spm/ramalan/{CODE}?year=&set=` URL was opened (not in the browser, not by fetch). "Jana Mock SPM", "Bagi Walkthrough", "Mula", "Mula Kuiz", "Pilih set" chips and "Sambung →" were never clicked.
- Client-side actions only: Latih Tubi option buttons (Alpine), Subjektif tabs, `<select>` changes on the mock and walkthrough forms (not submitted), and GET filter URLs of the structured list.
- Probed GETs (read-only pages): `/spm/latih-tubi/XYZ`, `/spm/ramalan/XYZ`, `/spm/ramalan/{BM,BI,BA,MATH}`, `/spm-mock/99999/result`, `/spm/tahun-lepas?subject=MATH`, `/latih-tubi`.
- Load was modest: sequential page loads in one browser lane, one worker tab; the 19 Latih Tubi subject pages were read once each (~600 ms apart) and the structured lists were sampled (page 1–2), not paged through.
