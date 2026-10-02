# L45 Jemput Ibu Bapa — G1 documentation audit

Date 2026-10-02. Auditor: independent audit agent. Scope: `docs/requirements/urs/L45-jemput-ibu-bapa.md` v0.1, `docs/requirements/srs/L45-jemput-ibu-bapa.md` v0.1, M01 SRS v1.16 change (Q8 closure, L45 cross-reference).
Live checks: Playwright lane 1 (admin session), GET only. Reference: `D:\Dev Projects\prestasiplus-reference` (blade views, `StudentExtrasController`, `routes/web.php`).

## Verdict: FAIL (2 Major, 5 Minor, 0 Critical)

Both Major findings are small, local fixes (one INFERRED claim contradicted by live, one wrong seed fact). After they are fixed the docs should pass on re-check of those items only.

## Findings

### AUD-L45-01 — Major — Non-hex token behaviour is contradicted by live (INFERRED claim is wrong)
- Docs: URS FN-L45-2.1.2, AC-L45-08.4; SRS §2 (S2-404 row and "Router rule"), FR-L45-21, §5 validation row, E2E-L45-17 say a token with a non-hex character falls through to the global 404 "Halaman Tidak Dijumpai". Tagged INFERRED, taken from the reference route constraint `where('token','[A-Fa-f0-9]+')` (reference `routes/web.php:1429`).
- Live evidence (GET `https://prestasiplus.my/ibu-bapa/terima/zzzz`): HTTP 404, tab title "Link Tidak Sah — PRESTASIPLUS", i.e. the same invalid-link page as for `0000`. A 64-zero token gives the same page (HTTP 404, same title, same copy, same icons, buttons `Log Masuk` → `/login`, `Laman Utama` → `/`, footer link → `/`).
- Impact: the docs write a rule that live disproves. CLAUDE.md §6: observed behaviour is replicated exactly; the router pattern would also break DV-free fidelity.
- Fix: remove the hex-only route constraint. S2 matches any `:token`; every token that is not the current token of an active student shows "Link Tidak Sah" (FR-L45-19/20 already define this). Delete FN-L45-2.1.2, FR-L45-21 and the S2-404 row; change AC-L45-08.4 to "OBSERVED: `zzzz` shows the Link Tidak Sah page"; E2E-L45-17 asserts the invalid page for `zzzz`; update the URS/SRS totals (functions 26 → 25, FR count, coverage lines) and XR-L45-07 ("hex-only token pattern"). Reference element REF-S2-019 disposition should say "superseded by live (non-hex also shows Link Tidak Sah)".

### AUD-L45-02 — Major — Seed fact wrong: student 3 has no school; E2E-L45-18 expects "SMK DEMO"
- SRS §6.4 last paragraph: "900001 'SMK DEMO' for 2 and 3". M01 SRS §6.8 row 3 (`pelajar2@demo.test`, line 403) has school "—"; only ids 2, 5, 8 are at 900001 (M01 line 436: "used by ids 2, 5 and 8"). Student 4 is at 900004 "SK Demo Bestari" (M02 v1.16; M01 line 404) — that part is correct.
- E2E-L45-18 (guest, valid token, likely student 3's) asserts the school line "SMK DEMO"; for student 3 no school line is shown (FR-L45-22: "when the student has a school"). The scenario would fail or assert a false expectation. FR/AC-09.1 and FR-L45-22 are fine.
- Fix: correct §6.4 to "900001 for 2; 900004 for 4; 3 has no school". In E2E-L45-18 either use student 2's token (school "SMK DEMO") or assert no school line for student 3, and add a case that covers both with and without school.

### AUD-L45-03 — Minor — `INVITE_INVALID` conflicts with the stable error-code list
- SRS §7 endpoint #3/#4: "404 `NOT_FOUND` with `error.code = INVITE_INVALID`". `docs/requirements/SRS.md:166` fixes the code set (`VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`, `SERVER_ERROR`). Fix: use `404 NOT_FOUND` only (the page is chosen by the status), or state the extra code as a documented sub-code in SRS.md.

### AUD-L45-04 — Minor — A viewer claim is tagged OBSERVED beyond what was observed
- URS AC-L45-08.1 ("any visitor (guest or logged in)") is tagged OBSERVED and FR-L45-19 says "Same page for every viewer (guest, parent, admin; admin OBSERVED)". Only the admin view was observed on live (re-verified today); the guest probe in discovery was a 404 without the body ("inconclusive", discovery §2). Fix: tag "admin OBSERVED; guest and parent INFERRED (same server template)". Also the phrase "Same page for every viewer" in the E2E-L45-15 (guest and admin) needs the same tag.

### AUD-L45-05 — Minor — AC-L45-08.2 has no E2E mapping
- SRS §12 lists ACs per scenario; AC-L45-08.2 (replaced link shows the invalid page) appears in no scenario's AC column, although E2E-L45-07 tests it in substance. Fix: add 08.2 to E2E-L45-07's AC column (and "Every AC ≥1 scenario" claim of 52/52 then holds literally).

### AUD-L45-06 — Minor — Nav item provenance wording differs from the code comment
- SRS FR-L45-31 says the href is "confirmed by live (guarded route)", while `src/shells/nav/user-nav.ts:466` comment says "href and icon INFERRED". Both are consistent in substance (route exists, discovery §2/§8), but the code comment is stale. Fix: update the comment when M23/shells is next touched (no doc change needed). Icon `fa-users`/`text-red-500` vs reference `fa-user-friends`/`text-rose-500` is correctly left unverified.

### AUD-L45-07 — Minor — DV-L45-01 and DV-L45-05 are not strictly D9 fixes of live behaviour
- D9 allows fixes only where live is broken or contradictory. DV-L45-01 replaces a reference note (never seen on live) with new invented copy ("Daftar akaun Ibu Bapa terlebih dahulu…"); DV-L45-04 and DV-L45-05 deviate from reference behaviour, not from live. The reasoning is sound (the reference note contradicts the live register that offers "Ibu Bapa"; a GET with side effects is unsafe) and each is minimal and listed, so this is acceptable under D23 as long as the table states "deviation from the reference; live behaviour unobserved" in the Type column and keeps the new copy tagged "Perlu pengesahan" (DV-01 does). DV-L45-02 (chip dropped: raw code `ibu_bapa`, and D12 forbids a new field on the M02 link store) and DV-L45-03 (D14) are justified. No DV is a redesign.

## Verified without findings (claims checked: 68)

Live (re-verified today, lane 1, GET only, no forms submitted):
- `/jemput-ibu-bapa` as admin: HTTP 403; title "403 - Akses Ditolak | PRESTASIPLUS"; body copy exactly as FR-L45-02 ("403", "🚫", "Akses Ditolak", the full sentence); links "Halaman Utama" → `/`, "Log Masuk" → `/login`; footer "PRESTASIPLUS". (7 elements)
- `/ibu-bapa/terima/0000` and the 64-zero token: HTTP 404; title "Link Tidak Sah — PRESTASIPLUS" (em dash); texts, icons (`fa-link-slash text-slate-300`, `fa-info-circle`, `fa-sign-in-alt`, `fa-home`, `fa-graduation-cap`), hrefs and footer line all equal OBS-INV-001…009 and FR-L45-19. (9 elements x2 tokens)
- Guest redirect, 405 on `/jemput-ibu-bapa/generate`: taken from discovery (guest test not repeated; the session is admin and POST/logout were forbidden). Marked recorded, not re-tested.

Reference quoting (all PROPOSED strings compared with `jemput-ibu-bapa.blade.php`, `terima.blade.php`, `StudentExtrasController`):
- S1: heading/subheading, hero H1 with emoji, "Link Jemputan", intro, "Salin"/"Disalin!" (2000 ms), "Hantar via WhatsApp", WhatsApp text and `rawurlencode`, "Jana Link Baru", flash "Link jemputan baru telah dijana!", "Ibu Bapa Dihubungkan", empty state strings, flash styling (green-50/200/700), 64-hex lazy token (`bin2hex(random_bytes(32))`), token rotation, parent ordering by name. (19)
- S2: valid-state eyebrow/H1 strings, success box, "Lihat Profil Kemajuan" → `/pelajar/{id}`, non-parent text and button, guest text and button, caption, tab title "Jemputan Ibu Bapa — PRESTASIPLUS", initials rule ("?" fallback), school line, inactive/role gate (`role=pelajar`, `is_active`), `firstOrCreate` idempotency, only `ibu_bapa` links. The reference note replaced by DV-L45-01 is quoted exactly. (13)
- The reference invalid-page copy is correctly rejected in favour of the observed live copy; relationship chip filled with `ibu_bapa` confirmed (DV-L45-02 reason holds).
- Reference S1 tab title is "Jemput Ibu Bapa — PRESTASIPLUS" (layout `@yield('title') — PRESTASIPLUS`); the docs choose "Jemput Ibu Bapa - PRESTASIPLUS" (app hyphen convention) and label it PROPOSED. Acceptable, flagged only for awareness.

Cross-module:
- M02: DATA-M02-02 (`id` seed 1–2, runtime from 1000, unique pair), BR-10, §6.15 line 545: parent 6 linked to 2 and 4, parent 5401 with 0 links; no second link store; L45 adds no field (D12 respected). XR-L45-02 correctly amends BR-10.
- M01: demo accounts 2, 3, 4, 6 and names ("Ibu Bapa Demo", "Pelajar Dua Demo"), BR-07 (parent → `/dashboard`), BR-08 (requested URL ignored), FR-M01-14 guard, FR-M01-18/19 (register offers "Ibu Bapa"), FR-M01-37 (logout, no confirmation), FR-M01-50 (404 page). v1.16 header and revision row: Q8 closed (D23c) and Q4 note present and consistent with L45 S2 (FR-L45-19…30), no FR or endpoint count changes claimed; closure text matches TRACKER D23.
- Router: `src/app/router/outcome.ts:32` `FORBIDDEN_TITLE = '403 - Akses Ditolak | PRESTASIPLUS'`; `ForbiddenPage.vue` is the same copy (checked by the SRS and consistent with the live text above).
- Privacy: no real person's name in either doc (demo names only); no generated media (initials/emoji/icons as text, D22); WhatsApp no navigation (D14).
- Counts: URS 26 functions (17+9), 12 stories, 52 ACs, coverage 19 + 23 + 21 = 63, 62 mapped + 1 dropped — recounted, all correct. SRS 33 FRs, 24 E2E scenarios; FR↔E2E: every FR appears in a scenario; AC↔E2E: 51/52 (AUD-L45-05).
- Responsive table present (375/768/1280, plus 320), security items SEC-L45-01…08 reasonable and backend-only, open questions OQ-01…10 classified non-blocking with a defensible default each; OQ-03 (seed reading) is the only cross-module one and is handled by XR-L45-03.

## Required to reach PASS
1. AUD-L45-01: remove the hex-only router rule and the global-404 behaviour for non-hex tokens (live shows "Link Tidak Sah").
2. AUD-L45-02: correct student 3's school (none) in §6.4 and E2E-L45-18.
Optionally fix the Minor items (03–05, 07) in the same revision.

---

# Round 2 (URS/SRS v0.2, 2026-10-02)

Method: re-read both docs at v0.2 and the changed lines in `src/shells/nav/user-nav.ts`; grep for leftovers of withdrawn items; recount totals; no live calls needed (round-1 live evidence for `zzzz` still stands).

## Closure of round-1 findings

| ID | Result | Evidence |
|---|---|---|
| AUD-L45-01 | Closed | FN-2.1.2 and FR-L45-21 withdrawn (IDs kept); S2-404 row removed; SRS §2 "Router rule" now OBSERVED, any token accepted; §5 `:token` row has no pattern; AC-L45-08.4 OBSERVED for admin (`zzzz`, 64 zeros); E2E-L45-17 asserts the invalid page for `zzzz` and 64 zeros; REF-S2-019 superseded; XR-L45-07 "no hex pattern". Grep finds no remaining "global 404", "hex-only", "S2-404" or "Halaman Tidak Dijumpai" in either doc outside change-log text. US-L45-08 and SRS §3.1 rows no longer cite FN 2.1.2 / FR 21 |
| AUD-L45-02 | Closed | SRS §6.4: 900001 for 2, 900004 for 4, student 3 no school (matches M01 §6.8); E2E-L45-18 split into student 2 (school line "SMK DEMO") and student 3 (no school line) |
| AUD-L45-03 | Closed | Endpoint #3/#4 now `404 NOT_FOUND` only; no `INVITE_INVALID` anywhere |
| AUD-L45-04 | Closed | AC-08.1 "OBSERVED for admin; guest and parent INFERRED"; FR-L45-19 same; E2E-L45-15 labels admin OBSERVED / guest INFERRED. Residual cosmetic: URS FN-L45-2.1.1 source tag still just "O" (see AUD-L45-08) |
| AUD-L45-05 | Closed | E2E-L45-07 AC column is now "04.2, 08.2" |
| AUD-L45-06 | Closed | `user-nav.ts:466` comment now "href confirmed on live ...; icon and colour INFERRED", consistent with FR-L45-31 |
| AUD-L45-07 | Closed | DV-L45-01/-04/-05 types state "deviates from the PROPOSED reference, not from live"; note under the table; DV-02/-03 rest on D12/D14 |

## Regression and consistency checks

- URS totals: FT 1.x = 3+2+7+4+1 = 17; EP-2 active = 5 (2.1.1, 2.1.3-2.1.6) + 3 (2.2.1-2.2.3) = 8; 25 active functions; 12 stories; 52 ACs (recounted). SRS header quotes the same.
- Coverage 63/63 unchanged: OBSERVED 19 (7 + 9 + 3), reference S1 23 (22 + 1 dropped), reference S2 21; REF-S2-019 still mapped (to FN-2.1.1). No element unmapped.
- SRS FRs: 33 IDs, 32 active (FR-21 withdrawn); every active FR still appears in at least one E2E (FR-19/20 via E2E-15/16/17, FR-33 via 15/18); stated "32/32" is correct.
- ACs to E2E: 52/52 now (08.2 added to E2E-07; 08.4 in E2E-17; 09.x in E2E-18/19). Traceability table §3.1 consistent with the FR and E2E columns.
- M01 v1.16 cross-reference unchanged and still consistent (no mention of non-hex 404 or the withdrawn items).
- Seeds: student 2 / 4 / 3 school facts match M01 §6.8 and M02 v1.16; links parent 6 to 2 and 4, student 3 unlinked, unchanged.

## New findings

### AUD-L45-08 — Minor — Source tag of FN-L45-2.1.1 not downgraded for guest/parent
- URS §3 table row FN-L45-2.1.1 has source "O". The change log says it is "OBSERVED for admin, INFERRED for guest and parent", but the row itself was not changed. Suggested fix: "O (admin) / I (guest, parent)". Cosmetic; does not affect ACs.

### AUD-L45-09 — Minor (informational) — Withdrawn IDs remain in the FN/FR lists
- FN-L45-2.1.2 and FR-L45-21 are kept as "Withdrawn" rows with IDs not reused. Acceptable and clearly marked; downstream consumers (task lists, tests) must skip them. No action beyond making sure the G2 task list does not reference them.

No Critical or Major findings are open.

## Round 2 verdict: PASS

All of AUD-L45-01..07 are closed. Two Minor observations (AUD-L45-08, -09) remain; neither blocks G1. Round-2 claims checked: 24 (7 closures, 8 recounts/trace checks, 9 leftover greps and cross-doc checks).
