# QA report: M21 Penajaan (Sponsorship), S6 Mohon Keluarga Angkat, G5

Scope: student screen S6 `/mohon-keluarga-angkat` (roles-matrix L20) only. Admin S1-S5, public S7 and the sponsor portal are deferred (M21-T3..T5); the S5 halves of E2E-49/50 are deferred to M21-T4. Code at `feature/student-prototype` 55d79b9. URS/SRS M21 v1.2.

Build: `npx vite build --mode e2e --outDir dist-e2e-s7-m21qa`, `vite preview` on port 5134 (stopped afterwards, only that PID), Playwright Chromium projects mobile 375x812, tablet 768x1024, desktop 1280x800, `--workers=1`. Config only in the scratchpad (`m21-qa/pw.mjs`). Exploratory work used Playwright MCP lane 1 only. Screenshots: `.playwright-mcp/m21-s6-375.png`, `-768.png`, `-1280.png`, `-success.png`, `-unknown.png`, `-e500.png`, `-mobile.png`.

## Verdict: READY (S6 only), with 2 Low observations and 1 environment caveat

- Every S6 AC executed and passes on all three viewports. No Critical, High or Medium bug. No horizontal scroll, no text under 12 px, no layout break at 375, 768 or 1280.
- 2 Low bugs (visual fidelity vs the live screenshot), neither blocks G5.
- Caveat: the machine was at 100 % CPU from other sessions. The first full run (54 tests) gave 47 pass / 7 fail; all 7 were environment failures (app boot or a 10 s in-spec expect timing out on an unrendered page, and `ERR_CONNECTION_REFUSED` after my preview server died). Re-running them alone, with `E2E_BOOT_TIMEOUT_MS=120000`, passed every one on its project. Before that, a first attempt with the default 15 s boot budget failed everything for the same reason (stopped, not counted). Treat the 15 s boot budget as fragile on a loaded host (test infrastructure, not an app bug).

## Runs

| Run | Result |
|---|---|
| `e2e/m21-sponsorship` (18 tests x 3 projects = 54), full run | 47 pass, 7 fail (all load or server-down, see caveat) |
| Re-run of the 7 failures plus the random flakes (desktop 10/46/47/48/66; mobile 10-ibubapa, 47 keyboard, 66; tablet same) | 8/8 desktop, 6/6 mobile+tablet pass |
| Net per project | 54/54 tests passed at least once, no test failed twice for an app reason |
| Exploratory browser run (MCP lane 1) | all checks below as expected |
| Unit/integration suites | not re-run by QA (not requested; G4/G3 owner results stand) |

## Test plan: AC to result

Evidence key: E2E = `e2e/m21-sponsorship/s6-mohon.spec.ts` (+ `smoke-mohon.spec.ts`); MCP = my browser session. Pass in each column means executed at that width.

| AC | Test cases | 375 | 768 | 1280 | Evidence |
|---|---|---|---|---|---|
| 01.3 menu entry (student shows, guru/ibubapa not) | MCP menu count per role | Pass | Pass | Pass | pelajar 2 links (sidebar+drawer), guru 0, ibubapa 0; E2E-04 |
| 01.4 S6 in user shell, no LIVE/MAIN/DAFTAR | E2E-04 | Pass | Pass | Pass | 3 projects |
| 02.2 header "Mohon Keluarga Angkat" / "Selamat datang kembali", tab title | E2E-07, smoke, MCP | Pass | Pass | Pass | not "Dashboard"; at 375 the title is truncated with an ellipsis (see B-02) |
| 03.1 guest to `/login` | E2E-08; MCP guest at 768 | Pass | Pass | Pass | URL `/login`, form count 0 |
| 03.3 pelajar, ibubapa, guru (and admin, penaja, adminsekolah) open S6 | E2E-10 x3; MCP 5 more roles | Pass | Pass | Pass | form renders, header correct |
| 16.1 hero, e-mail field, hint, "sini" to `/register`, both selects | E2E-46; MCP | Pass | Pass | Pass | placeholders, 5+4 options and BM labels verified exact |
| 16.2 five examples exact; click 2 sets textarea with "• ", no request; click 4 replaces | E2E-47 x2; MCP | Pass | Pass | Pass | 0 `/api` requests on click |
| 16.3 note, button, info box with 4 steps, "Siapa boleh mohon?" 3 entries | E2E-48; MCP | Pass | Pass | Pass | "Guru / Kaunselor — mohon untuk pelajar yang dikenal pasti memerlukan" exact |
| 17.1 empty e-mail/category/reason, e-mail "abc": browser check, no request | E2E-49; MCP | Pass | Pass | Pass | valueMissing and typeMismatch true, 0 requests |
| 17.2 success notice, empty form | E2E-50; MCP | Pass | Pass | Pass | notice text exact, all 4 fields reset (S5 "Menunggu 4" half deferred to M21-T4) |
| 17.3 unknown e-mail and a non-student e-mail: 422 message, nothing created | E2E-51; MCP | Pass | Pass | Pass | "Email pelajar tidak dijumpai dalam PrestasiPlus." |
| 17.4 ibubapa submit | E2E-50 ibubapa | Pass | Pass | Pass | 201; S5 "parent" row half deferred to M21-T4 |
| 23.1 no horizontal scroll, text >= 12 px | E2E-66; MCP | Pass | Pass | Pass | scrollWidth equals clientWidth; 0 text nodes under 12 px (also after a 422) |
| 23.2 single centred column max ~670 px, H1 24 px | E2E-67; MCP | Pass | Pass | Pass | column 342 / 670 / 670 px wide; centred at 768 and 1280 |
| Whitespace-only reason (V-M21-03) | MCP | Pass | n/a | n/a | "Sila isi ruangan ini.", no record (checked at 375) |
| 500 and network error (mock hooks `failNext`, `networkErrorNext`) | MCP | Pass | n/a | n/a | "Ralat berlaku. Sila cuba lagi."; typed values kept; button back to "Hantar Permohonan" |
| Touch usability | E2E-66; MCP | Pass | Pass | Pass | button 48 px, each example 81 px tall, inputs 42-43 px (selects/inputs under 44 px, same as live form controls; not an AC), inline "sini" link 15 px high (inline text link, not an AC) |

Counts: 14 ACs (01.3, 01.4, 02.2, 03.1, 03.3, 16.1, 16.2, 16.3, 17.1, 17.2, 17.3, 17.4, 23.1, 23.2) executed on 3 viewports = 14/14 Pass; 3 extra checks (whitespace, 500/network, touch) Pass. Deferred, not counted: S5 halves of 17.2, 17.4 and AC-14.x.

## Comparison with discovery screenshots (`docs/discovery/img/M21/mohon-keluarga-angkat-*.png`)

Copy, field order, option labels, example text, info box and single-column layout match. Visual theme differs (B-01, B-02).

## Bugs

| ID | Severity | Steps | Expected | Actual | Screenshot | Owner |
|---|---|---|---|---|---|---|
| B-01 | Low | Open S6 at 1280 or 375 as pelajar | Live: hero is a blue gradient with left-aligned H1 and lead, submit button solid blue (discovery screenshots, desktop and mobile) | Hero is a pink-to-purple gradient with centred text; submit button pink-to-purple. URS/SRS only say "gradient hero" with no colour, so this may be the prototype theme (Perlu pengesahan) | `.playwright-mcp/m21-s6-1280.png` vs `docs/discovery/img/M21/mohon-keluarga-angkat-desktop.png` | frontend-developer / ui-ux-designer (decide: replicate blue, or accept theme) |
| B-02 | Low | Open S6 at 375 | Shell header title readable (live shows the short "Dashboard"; DV-M21-06 replaces it with "Mohon Keluarga Angkat") | Title is cut to "Mohon Keluarga ..." by an ellipsis because of the bell, menu and logo; the sub-title is full | `.playwright-mcp/m21-s6-375.png` | frontend-developer (shell header, shared with other long titles) |

Test infrastructure note (not an app bug): `e2e/fixtures/mock-handle.ts` boot budget 15 s and the 10 s `expect` override at the top of `s6-mohon.spec.ts` are too tight on a loaded host; `E2E_BOOT_TIMEOUT_MS` is already supported.

## Final verdict: READY

G5 exit criteria met for S6: all in-scope ACs executed and Pass at 375, 768 and 1280; no open Critical or High bug. Open items: B-01 and B-02 (Low), S5 halves of AC-17.2/17.4 to be verified in M21-T4. The preview server on 5134 was stopped.
