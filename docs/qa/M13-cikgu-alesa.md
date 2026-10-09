# QA report: M13 Cikgu Alesa (L42 Murid), G5

Code under test: `feature/student-prototype` at 2520e23 (G4 fix round merged). Build: `npx vite build --mode e2e --outDir dist-e2e-s7-m13qa`, served with `vite preview` on port 5138 (stopped afterwards, build folder removed), Playwright Chromium, projects mobile 375x812, tablet 768x1024, desktop 1280x800, `--workers=2`, `E2E_TIMEOUT_FACTOR=4 E2E_BOOT_TIMEOUT_MS=120000`, test timeout 150000. The Playwright config lives only in the scratchpad (`m13-qa/playwright.s7.config.mjs`). No source code was edited and no spec was added (the developer suite covers every E2E-M13-01..52 case; see "Notes").

Scope: S1 chat (guru, pelajar, ibu bapa, admin), teacher screens S2 to S6, V1, V2; S7 and S8 fall to the global 404. AI and voice are simulated (D4): no network call was made.

## Verdict: READY

- Every one of the 77 ACs was executed and passed on the E2E suite at 375, 768 and 1280, and the exploratory pass in a real browser found no contradiction.
- No Critical or High bug. No layout break: `scrollWidth` is at or below the viewport width on all 8 M13 routes at all three widths; no M13 text under 12px; interactive controls are at least 44px high at 375 ("Lihat" links 44px; chat input, mic and "Hantar" 48px).
- One Low bug (BUG-M13-01) and one Low note (BUG-M13-02, test infrastructure). Neither blocks G5.
- Provisional ACs (canned AI text, quota limit, seeded teacher rows, INFERRED role guards) pass against the proposed values; they stay provisional until the backend phase, as the URS says.

## Runs

| Run | Result |
|---|---|
| `e2e/m13-cikgu-alesa` (smoke-chat 31 + smoke-teacher 42 cases = 73 per project, 219 over 3 projects), first run | 217 pass, 2 fail |
| The 2 failures (E2E-M13-03 and E2E-M13-05, mobile only) | Both timed out in the first minutes while the preview server was being replaced under the run (the Playwright `webServer` rebuilt `dist` while my own preview was still serving it). Re-run alone with `--workers=1` on all 3 projects: **6 of 6 pass**. Not product bugs. |
| **Final** | **219 of 219 pass (73 per project x 3), 0 fail, 0 skipped** |
| `npx vitest run src/modules/m13-cikgu-alesa` | 6 files, 87 tests pass. 4 "worker timeout" errors from the vitest pool because the machine was loaded (BUG-M13-02); no test failed. |
| Console errors during exploratory pass | 0 |

## Test plan: AC x viewport

Legend: Pass = executed and passed. `E2E-nn` = `E2E-M13-nn` in `e2e/m13-cikgu-alesa/smoke-chat.spec.ts` (nn 03 to 30) or `smoke-teacher.spec.ts` (nn 01, 02, 04, 06 to 09, 31 to 52). `Expl` = I also checked it by hand in the browser (guru, pelajar, ibu bapa, admin sessions). 375 / 768 / 1280 columns show the E2E result per project.

| AC | Test cases | 375 | 768 | 1280 | Result |
|---|---|---|---|---|---|
| 01.1 sidebar entries and badge | E2E-01 | Pass | Pass | Pass | Pass |
| 01.2 drawer order | E2E-01 | Pass | Pass | Pass | Pass |
| 01.3 active entries | E2E-02 | Pass | Pass | Pass | Pass |
| 01.4 header and tab titles S1-S6 | E2E-03; Expl (titles of S1, S3, S6 seen) | Pass | Pass | Pass | Pass |
| 01.5 bottom nav, "Chat" opens shell panel | E2E-04 | Pass | Pass | Pass | Pass |
| 02.1 guest to /login | E2E-05; Expl (4 routes) | Pass | Pass | Pass | Pass |
| 02.2 unknown paths show 404 | E2E-06; Expl (/history, /quota, export.csv as pelajar, /rph/abc, /rph/13101/print) | Pass | Pass | Pass | Pass |
| 02.3 GET of post-only paths shows 404 | E2E-07 | Pass | Pass | Pass | Pass |
| 02.4 other user's record shows 404 | E2E-08 | Pass | Pass | Pass | Pass |
| 02.5 trailing slash, ?classroom_id= | E2E-09 | Pass | Pass | Pass | Pass |
| 02.6 pelajar / ibu bapa: S1 yes, S2-S6 to landing page | E2E-10 (pelajar, ibu bapa); Expl (both land on /dashboard from /rph, /essay, /pbd, /rph/baharu, /essay/baharu, /rph/13101, /essay/13201) | Pass | Pass | Pass | Pass |
| 03.1 S1 default content | E2E-11 | Pass | Pass | Pass | Pass |
| 03.2 reply is plain text | E2E-12; Expl (`<b>x</b>` literal, 0 `<b>` nodes) | Pass | Pass | Pass | Pass |
| 04.1, 04.2 send, busy, reply, usage line | E2E-13; Expl (guru: "Cikgu Alesa sedang berfikir…", disabled, input cleared, focus back, meta "Tier: guru · Turns remaining: 29 · Tool hops: 0 · Tokens: in=126 out=62") | Pass | Pass | Pass | Pass |
| 04.3 thread id, practice reply, hops | E2E-14; Expl (hops 1, turns 28) | Pass | Pass | Pass | Pass |
| 04.4 empty and whitespace input | E2E-15; Expl | Pass | Pass | Pass | Pass |
| 04.5 reload resets | E2E-16; Expl | Pass | Pass | Pass | Pass |
| 04.6 empty reply "(tiada respon)" | E2E-17; Expl | Pass | Pass | Pass | Pass |
| 05.1, 05.2 500 with and without error text | E2E-18 | Pass | Pass | Pass | Pass |
| 05.3 quota used up | E2E-19; Expl (hook: fallback text and "Quota habis untuk hari ni.") | Pass | Pass | Pass | Pass |
| 05.4 network failure line, "Hantar" enabled, focus | E2E-20 | Pass | Pass | Pass | Pass |
| 05.5 quota follows the mock clock (29 left) | E2E-21; Expl (29 on first send) | Pass | Pass | Pass | Pass |
| 06.1 `?ask=` fills, focuses, sends nothing | E2E-22; Expl (full load, and a router push while already on /cikgu with text typed: input replaced, focus in input) | Pass | Pass | Pass | Pass |
| 07.1, 07.2 essay hand-off URL and message | E2E-23 + hand-off variant; Expl (URL `...rubric=sejarah_essay&subject=Sejarah&level=T5&student=Murid+Demo+03&title=Semangat+Patriotisme`, message text as AC, sessionStorage key removed) | Pass | Pass | Pass | Pass |
| 07.3 mark_essay without stored essay | E2E-24 | Pass | Pass | Pass | Pass |
| 07.4 marks reply and S4 list | E2E-25, E2E-41; Expl (reply "Markah: 14/20", hops 1, new row first in list, V2 opens) | Pass | Pass | Pass | Pass |
| 08.1 voice switch remembered | E2E-26; Expl (localStorage 1 then 0) | Pass | Pass | Pass | Pass |
| 08.2 speaking status, no speech API | E2E-27; Expl ("🔊 Cikgu sedang bercakap…" shown then cleared, speak/recogniser spy count 0) | Pass | Pass | Pass | Pass |
| 09.1 voice unsupported hook | E2E-28 | Pass | Pass | Pass | Pass |
| 09.2 simulated dictation and auto-send | E2E-29; Expl (mic "🔴" on rgb(254,226,226), "Mendengar...", input "Terangkan pecahan setara dengan contoh", sent, mic back to "🎤", status empty) | Pass | Pass | Pass | Pass |
| 09.3 second click, error step, in-flight dictation | E2E voice variants (3); Expl (error hook: "Maaf, tak dengar." then cleared, nothing sent) | Pass | Pass | Pass | Pass |
| 09.4 mic title | E2E-30; Expl ("Tekan untuk cakap") | Pass | Pass | Pass | Pass |
| 10.1, 10.2 admin S2 empty and pager | E2E-31 | Pass | Pass | Pass | Pass |
| 10.3 teacher S2 rows | E2E-32; Expl (13101, 13102 links) | Pass | Pass | Pass | Pass |
| 11.1 S3 layout and defaults | E2E-33 | Pass | Pass | Pass | Pass |
| 11.2 subject datalist (31 options) | E2E-33 (count 31) | Pass | Pass | Pass | Pass |
| 11.3 level options | E2E-33 | Pass | Pass | Pass | Pass |
| 11.4 length limits 200 / 500 | E2E-33; Expl (maxLength 200 and 500) | Pass | Pass | Pass | Pass |
| 11.5 info box and wait note | E2E-33 | Pass | Pass | Pass | Pass |
| 11.6 "Batal" resets | E2E-34 | Pass | Pass | Pass | Pass |
| 11.7 columns per width | E2E-34 | Pass | Pass | Pass | Pass |
| 12.1 required and range checks | E2E-35; Expl (duration 10 gives "Value must be greater than or equal to 15.") | Pass | Pass | Pass | Pass |
| 12.2 busy label | E2E-36; Expl ("Cikgu Alesa sedang jana RPH…", disabled, opacity-60) | Pass | Pass | Pass | Pass |
| 12.3 V1 content and list order | E2E-36; Expl (to /cikgu/rph/9000001, all content blocks, new row first because its date is latest) | Pass | Pass | Pass | Pass |
| 12.4 "Keperluan Khas" at the end | E2E-36; Expl | Pass | Pass | Pass | Pass |
| 13.1 class pick fills fields | E2E-37; Expl (options and values as AC; fields stay editable) | Pass | Pass | Pass | Pass |
| 14.1, 14.2 RPH by chat | E2E-38 | Pass | Pass | Pass | Pass |
| 15.1 V1 for 13101, print is 404 | E2E-39; Expl (print 404) | Pass | Pass | Pass | Pass |
| 15.2 V2 for 13201 | E2E-39; Expl ("Murid Demo 01", "35/50", comment lines) | Pass | Pass | Pass | Pass |
| 15.3 bad ids give 404 | E2E-39; Expl (/rph/abc 404) | Pass | Pass | Pass | Pass |
| 16.1 admin S4 empty | E2E-40 | Pass | Pass | Pass | Pass |
| 16.2 teacher S4 rows | E2E-41 | Pass | Pass | Pass | Pass |
| 17.1 S5 layout, six rubrics | E2E-42; Expl (six rubric labels in order) | Pass | Pass | Pass | Pass |
| 17.2, 17.3 word counter, 50-character rule | E2E-43; Expl (counter "17 perkataan" for two-space text; short text raises the native alert "Karangan terlalu pendek (minimum 50 aksara)." and stays on S5) | Pass | Pass | Pass | Pass |
| 17.4 Enter, "Batal", reload | E2E-44 | Pass | Pass | Pass | Pass |
| 17.5 "Rubric Am (default) (100 markah)" label | E2E-42 | Pass | Pass | Pass | Pass |
| 18.1 admin S6 empty | E2E-45 | Pass | Pass | Pass | Pass |
| 18.2 placeholder rollup, no dialog | E2E-52 | Pass | Pass | Pass | Pass |
| 18.3 teacher S6 nine rows | E2E-46; Expl (9 rows in AC order) | Pass | Pass | Pass | Pass |
| 18.4 rollup raises Murid Demo 08 to 22.2% | E2E-47 | Pass | Pass | Pass | Pass |
| 18.5 approved students get no new row | E2E-47 | Pass | Pass | Pass | Pass |
| 19.1 "Pilih semua" toggles all rows | E2E-48; Expl (9 ticked, then 0) | Pass | Pass | Pass | Pass |
| 19.2 bulk approve two rows | E2E-48; Expl (queue 9 to 7 rows, "Pilih semua" unticked after reload) | Pass | Pass | Pass | Pass |
| 19.3 nothing ticked changes nothing | E2E-48; Expl (still 9 rows) | Pass | Pass | Pass | Pass |
| 19.4 `#bulk-form` DOM | E2E-49 (guru, admin); Expl (0 nested forms, every row checkbox owned) | Pass | Pass | Pass | Pass |
| 20.1 teacher CSV | E2E-50; Expl (file `pbd-approved.csv`, header `pelajar,kelas,sp,skor,tp,tarikh_lulus`, 2 seeded rows plus the 2 I approved) | Pass | Pass | Pass | Pass |
| 20.2 admin CSV header only | E2E-50b | Pass | Pass | Pass | Pass |
| 21.1 no horizontal page scroll, S1-S8, V1, V2 | E2E-51 (9 routes incl. unknown); Expl (scrollWidth <= viewport on 8 routes x 3 widths) | Pass | Pass | Pass | Pass |
| 21.2 S1 mic, input, "Hantar" on one row | E2E-51 S1; Expl (screenshot at 375) | Pass | Pass | Pass | Pass |
| 21.3 tables scroll inside their card | E2E-51 (S2, S4, S6) | Pass | Pass | Pass | Pass |
| 21.4 S6 toolbar stacks below 768 | E2E-51 toolbar | Pass | Pass | Pass | Pass |

Total: 77 ACs, 77 Pass, 0 Fail, 0 Blocked.

## Exploratory checks (Playwright lane 1, preview on 5138)

- S1 as guru: send, busy state, usage line, two turns, canned practice reply, voice string, mic states, error hook, empty reply, `<b>` literal, quota hook, reload reset, whitespace and empty input: all as the ACs.
- S1 as pelajar: input present, reply works, meta reads "Tier: pelajar · Turns remaining: 9 · Tool hops: 0". S2-S6 and record URLs go to `/dashboard`. Ibu bapa: same.
- Guest: `/cikgu`, `/cikgu/rph`, `/cikgu/essay/baharu`, `/cikgu/pbd` all go to `/login`.
- Not interceptable in the browser: the mock lives inside the page (no real network), so `page.route` could not inject a 429, 422 or network failure. Those paths (500 with and without text, quota, network error, non-JSON body) were verified through the E2E `failNext` hooks (E2E-18, 19, 20), which passed.
- 422: the mock has no 422 path in the spec and none in the E2E suite; the fallback text is the same one E2E-18 and E2E-19 assert.
- RPH: list, form, class pick, submit, V1, list order; essay list, form, short-text alert, hand-off, marks reply, V2; PBD queue, "Pilih semua", bulk approve, CSV export, all as the ACs. "Pilih semua" is a checkbox label (as in the DOM spec), so it resets when the queue reloads after a bulk approve.
- Layout: no horizontal scroll, no M13 text under 12px, touch targets at least 44px high at 375/768/1280. Screenshots compared with `docs/discovery/img/M13/` (chat-mobile, pbd-mobile): same structure. Known intentional differences from the live capture are the D9 fixes (DV-M13-03 "Hantar" kept inside the card, buttons full width at 375) and the shell header (guru shell, "Selamat datang kembali").
- CSV formula neutralising: could not be exercised end to end, because the demo data has no student named with a leading `=`, `+`, `-` or `@` and no hook renames one. Verified by reading `csvCell` in `src/modules/m13-cikgu-alesa/mock/repository/cikgu.ts` and by its unit test (`csv-cell.test.ts`, passing: `=HYPERLINK(...)` becomes `'=HYPERLINK(...)`). Real export file opened: the four rows have no leading formula characters.

Screenshots (`.playwright-mcp/`): `m13-s1-guru-1280.png`, `m13-s1-pelajar-1280.png`, `m13-s3-guru-1280.png`, `m13-v1-guru-1280.png`, `m13-v2-guru-1280.png`, `m13-s6-guru-1280.png`, `m13-s1-guru-375.png`, `m13-s6-guru-375.png`, `m13-s3-guru-375.png`; the exported file is `.playwright-mcp/pbd-approved.csv`.

## Bugs

| ID | Severity | Steps to reproduce | Expected vs actual | Screenshot | Suspected owner |
|---|---|---|---|---|---|
| BUG-M13-01 | Low | Read `csvCell` in `src/modules/m13-cikgu-alesa/mock/repository/cikgu.ts` line 255: `if (/^[=+@-]/.test(s)) s = ...`. Export a student whose name starts with a TAB (`\t=1+1`) or CR (`\r=1+1`). | Expected: formula neutralising also covers a leading TAB or CR (the OWASP CSV-injection list is `= + - @ TAB CR`). Actual: those two leading characters are not prefixed. The URS and SEC-M13-04 name only `= + - @`, so the AC passes; this is hardening for the backend phase (the real server must do the same). | none (code reading; unit test passes) | backend-developer |
| BUG-M13-02 | Low (infrastructure, not product) | Run the vitest suite or the first Playwright test while another build or preview is replacing `dist-e2e-*`. | Expected: stable run. Actual: "Timeout waiting for worker" in vitest and two first-run E2E timeouts that pass on re-run. Cold E2E-M13-03 takes about 1.2 minutes per project on the build under load. | none | devops-engineer |

No Critical, High or Medium bugs.

## Notes

- Backend-phase items given in the brief (S2 student tool routes, S3 name in the URL, S4 retention, S6 length caps) are not tested here and are not bugs of the prototype.
- The developer suite covers every acceptance criterion at all three widths, so I added no QA spec; every AC row above was executed (E2E result in the three columns) and, where marked, also checked by hand.
- Order of the "Lihat" list rows after my exploratory runs includes my own generated records (ids 9000001 and above). In the browser the mock kept those records across full page loads in my session (they were still listed after navigation), while each E2E test starts from a fresh browser context.
