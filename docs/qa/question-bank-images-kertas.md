# QA: question-bank images + kertas (G5 targeted, Standard track)

Date: 2026-10-30. Branch local/v2-full. Stack: http://localhost:5192 (api, frontend, db containers). Browser lane 3 (Playwright MCP) plus curl against the API. Evidence folder: `C:\Users\hp\AppData\Local\Temp\claude\d--Dev-Projects-prestasiplus\8858a3c7-b567-49a0-8982-aff5c522c55a\scratchpad\qb-qa\` (screenshots `t*.png`).

## Step 1: stack currency
No rebuild needed. API container started 14:27 local (about 13 min before the run); `GET /api/questions/17` returns the `kertas` key; the admin create form shows the "Kertas" select (options: —, Kertas 1, Kertas 2, Kertas 3). Migration log line (from `pretasiplus-migrate-1`): `Applying migration \`0092_part_options_image_file_index\``; `_prisma_migrations` lists 0092 as the latest row. No other compose projects running (only a testcontainers-ryuk, an unrelated container and buildx).

## Test plan and results

| # | Check | Method | Result |
|---|---|---|---|
| 1 | Admin create MCQ, no image, Kertas 2: saves, success message, Kertas 2 stored | UI | Pass. Flash "Soalan berjaya ditambah." (t1-toast.png); `GET /api/questions/<id>` kertas "2"; edit form re-loads "Kertas 2". Note: the read-only detail page has no Kertas field at all (see OBS-1). |
| 2 | Create with stem image + option A image; render on detail/edit | UI + API | Pass. POST /api/files 201 then JSON POST; API returns `questionImage` token and `optionImages[0]` token; both `<img>` load (naturalWidth 40) on detail and edit (edit images are lazy-loaded). t2-*.png |
| 3a | Edit with Kertas set to "—" on a question with kertas 2 clears it | UI + DB | Pass. kertas null, `paper_code` went from `MATH/2` to `MATH`. |
| 3b | Unrelated edit of a question whose paper_code is not 1-3 keeps it | API (PUT, kertas omitted) on a QA row with `MATH/4` set directly in DB | Pass. paper_code stays `MATH/4`, no new version. Also with explicit `"kertas":null` it stayed `MATH/4` (see OBS-3). |
| 4a | Remove option image | UI | Pass. optionImages all null after save. |
| 4b | Replace question image | UI | Pass. New token shown and loads; DB shows exactly 1 stimulus row for the version (old not duplicated). |
| 5 | Short questionText: inline field error (422 mapping) | UI | Pass. POST returned 422; inline "Teks soalan mesti sekurang-kurangnya 10 aksara." under the field, form stays. t5-validation.png |
| 6a | CSV with `kertas` column: valid rows import | UI | Pass. Rows with kertas 2 and blank imported as drafts; paper_code `MATH/2` and empty. |
| 6b | Bad kertas "9" fails that row "Kertas tidak sah." | UI + API | Pass at API: failures `[{"row":4,"message":"Kertas tidak sah."}]`, importedCount 2, failedCount 1. UI toast shows only "Import selesai: 0 soalan diimport, 1 gagal." (row message not shown in UI, see OBS-2). |
| 7 | Paper builder candidate | API (`GET /api/admin/papers/2`, MAT Kertas 2) | Pass (API only; the editor UI was not exercised). Candidates 15 before; after publishing the QA Matematik Kertas 2 question (draft, review, approved, published, with DSKP tag) there are 16 and it is present with kertas 2, subject MAT. Not listed in Kertas 1 paper (id 1). Back to 15 after cleanup. |
| 8 | Guru Sumbang Soalan create with image | UI (guru@demo.test) | Pass. POST /api/files?purpose=question_image 201, then POST /api/guru/questions 201 (application/json); question saved in status review; stem image token present. |
| 9 | Pupil image access | curl, murid4@demo.test | Pass. Published question image: 200 image/png. Draft question image: 404. Review-status image: 404. Replaced/orphan upload: 404. Anonymous: 401 for all. Admin 200 for all. |
| 10 | Responsive create form 375/768/1280 | UI | Pass. documentElement scrollWidth equals clientWidth at all three (375/768/1280), also after selecting a value. Kertas select 44 px high, options readable and selectable at each width. t10-375/768/1280-*.png |

Console: only the expected 401 on `/api/session` before login; no other errors. Failed network: none besides intended 422.

## Bugs
No bug in the changed scope. No Critical/High.

### Observations (not blocking; owner in brackets)
- OBS-1 (Low, frontend-developer): the admin detail page `/admin/questions/<id>` does not show Kertas. The requirement addendum only requires the form, the API and CSV, so treated as a gap against the brief, not an AC failure.
- OBS-2 (Low, frontend-developer): after CSV import the UI shows only the count toast and the history page shows counts only. The per-row text "Kertas tidak sah." is only visible in the API response (`/api/question-imports`).
- OBS-3 (Info, backend-developer): `PUT` with `kertas: null` on a version whose paper_code ends in a digit other than 1-3 (e.g. `MATH/4`) leaves it unchanged, since the read model reports null for it. Consistent with the "keeps" rule, just confirm that is intended (an admin cannot clear such a code).
- OBS-4 (Medium, outside this change; owner is the session that edits `levels.json` / `scope()`): `GET /api/questions` (and `?status=published`) returns `data: []` while `meta.totalItems` is 1268, so the admin Bank Soalan list shows no published questions. Primary levels D1-D6 are `is_active=false` in the running DB and most published questions are on them. Draft/review rows (Tingkatan levels) do list. The CSV template sample rows also use `education_level_id` 4 and 1 (inactive levels). Not caused by images/kertas; flagged because it affects anyone verifying via the list.
- OBS-5 (Info): QA harness note, setting a difficulty radio by forced click is unreliable; clicking its label works. Not an app defect.

## Cleanup
- Questions 1289-1295 (all QA-TEST) deleted via bulk-action delete (affected 7); DB check shows no question or version rows with id >= 1289. Paper 2 candidate count back to 15.
- Cannot clean up: uploaded files (about 6 small PNGs, no delete endpoint; the published-question image token `vCYv6FkvJ-GWkGeCRl3QJw` now returns 200 to admin only as an orphan upload); two `question_imports` history rows (`import.csv`, `bad.csv`, ids 1 and 2) with no delete endpoint. My own scratch PNG/CSV copies in `.playwright-mcp/lane3` were removed.
- Data touched outside the UI: one DB UPDATE of `question_versions.paper_code` on a QA row (since deleted).

## Verdict
Ready to release for the scope of this change (images, JSON save, kertas, paper-builder candidate, pupil image access, responsive). All 10 checks executed and Pass. Caveats: paper-builder check was API-level only; OBS-4 (admin list empty for published questions) should be raised with the owning session before the whole branch ships, but is not part of this feature.
