# Amin2 after-go-live backlog

| | |
|---|---|
| Status | Draft, 26 Oct 2026, updated for the LEAD decisions of 26 Oct 09:34 MYT (#109 comment 6406299561, same text on #113) and PRs #367 to #371 |
| Owner | Half AM (Amin2) |
| Go-live | 30 Oct 2026 |
| Purpose | One list of every Amin2 item deferred until after go-live, so the LEAD and the team can schedule it. For each item: source, owner, the LEAD decision it waits on, and its current branch or PR. |

How to read it:

- **Source** is a GitHub comment id or a PR number. UAT finding ids (`M02 BUG-01`, `M10 B1`) come from the UAT findings list kept by half AM (not committed to the repo).
- **Waits on** names the LEAD decision. `-` means no decision is needed; the item only needs time. A decided item shows the decision code (D28 to D39, from #109 comment 6406299561), the decision date and the PR. Decisions dated 26 Oct 09:34 MYT are written "D.. (26 Oct)".
- **Branch/PR** is the head branch and PR as last seen on origin. `n/a` means no branch exists yet. Items marked **Perlu pengesahan** could not be verified from git or the PR list and must be confirmed before scheduling.
- **Size**: S under half a day, M up to two days, L more. These are estimates, not commitments.
- Owner "Half AZ" means the file is a shared file and Amin2 only proposes the patch (see group 4).
- No secrets, real names or real data counts are listed here, by project rule.

## 0. Merge under a dated freeze exception (D34)

Not after go-live any more. The LEAD chose "R39-C4: 2" on 26 Oct 09:34 MYT (D34; #109 6399369645, 6402394115): the code stays as it is and the notice is corrected. D34 gives a dated freeze exception for FE only on #226 + #357. Both are out of draft; they are pending merge.

| ID | Item | Source | Owner | Waits on | Branch/PR | Size |
|---|---|---|---|---|---|---|
| E01 | Forced password change screen `/password/change` (AM2-A1, M01 part) | #226; #109 / 6406299561 (D34) | Amin2 | Merge only (D34, 26 Oct) | `fe/AM2-A1-forced-password-change`, #226 `ae57434c` (not draft) | M |
| E02 | Router redirect: send a flagged session to `/password/change` (half-AZ part of AM2-A1) | #357; #109 / 6406299561 (D34) | Amin2 proposes, half AZ merges | Merge only (D34, 26 Oct). Per #109 / 6401621581, the combined e2e passes at 375/768/1280 and fails without #357 | `fe/AM2-A1-router-redirect`, #357 `b9848d4e` (not draft) | S |

## 1. LEAD decisions

Items that cannot start until the LEAD answers. Questions were raised on #109 (comments 6399195617, 6399721389 and the digest 6401621581) and #113 (comment 6399706180). The LEAD answered on 26 Oct 09:34 MYT (#109 comment 6406299561). Rows still marked "open" have no decision yet. Decided rows stay `[after go-live]` drafts, except the D34 items in group 0.

| ID | Item | Source | Owner | Waits on | Branch/PR | Size |
|---|---|---|---|---|---|---|
| L01 | M10 B1: admin gets "Gagal memuatkan" on `/guru/kelas`; drop the admin from that route or give admin a view | #109 / 6399195617 | Amin2 | **Decided D32 (26 Oct): "M10-B1: drop admin"**; after go-live | `fe/AM2-G5M10-b1-admin-meta`, #350 `f6c73008` (draft; G4 REQUEST CHANGES, fix in progress per #109 / 6401621581) | S |
| L02 | M10 B2: class-create school picker offers any school; restrict to the teacher's own school | #109 / 6399195617 | Amin2 | **Decided D32 (26 Oct): "M10-B2: own school"**; after go-live | `fe/AM2-G5M10-b2-own-school`, #347 `9c869379` (draft; G4 APPROVE WITH MINORS per #109 / 6401621581) | S |
| L03 | M10 B4: teacher remedial link goes to `/guru`; patch the link target | #109 / 6399195617 | Amin2 | **Decided D32 (26 Oct): "patch"**; half-AZ shared file, after go-live | `fe/AM2-G5M10-b4-remedial-scope`, #369 `c308454c` (draft patch proposal) | S |
| L04 | M02 BUG-01: renewal invoice table empty; contract needs `students[]` | #109 / 6399195617 | Amin2 (FE) with BE | **Decided D32 (26 Oct): "BUG-01: add field"**; after go-live. The personal-data DECISION named in #109 / 6401621581 row 4 is not recorded in the LEAD answer (open) | BE `be/AM2-G5M02-bug01-invoice-students`, #354 `c0ea23db` (draft; G4 APPROVE WITH MINORS; option A, no idDelima, contract patch in the body); FE `fe/AM2-G5M02-bug01-invoice-students`, #356 `74bb4d6c` (draft) | M |
| L05 | M02 BUG-06: forms are two columns at 640-767 px and the modal is 512 px | #109 / 6399195617 | Amin2 | LEAD call on a 24 px gap (open). Fix PR waits on it; after go-live | `fe/AM2-G5M02-bug06-form-columns`, #371 `fcc8030c` (draft; related: #323, #324) | S |
| L06 | M08 B3: S6/S19/S20 read different sources; align the code or change the doc | #109 / 6399195617 row 6 | Amin2 | **Decided D32 (26 Oct): "doc"**; docs only, after go-live | `docs/AM2-m08-b3-m17-a`, #367 `6df647ac` (draft) | M |
| L07 | M11-B5: S2 counts vs the S3/S5 minimisation filter; change the filter or the doc | #109 / 6399195617 row 7 | Amin2 | **Decided D32 (26 Oct): "M11-B5: filter"**; after go-live | `be/AM2-G5M11-b5-filter`, #349 `2a6530a8` (draft; G4 APPROVE WITH MINORS per #109 / 6401621581) | M |
| L08 | #307 GAMIF-REF (a) reference seed for achievements, challenges and settings, (b) the settings defaults, (c) challenge adoption by title | #307; #109 / 6399195617 rows 8-10 | Amin2 (Dev4) | **Decided D28 (26 Oct): (a) full, (b) ok, (c) accept**; after go-live. Check challenge titles at A4 (see #109 / 6399195617 row 10) | `be/AM2-GAMIF-REF-reference-catalogue`, #307 `e633d285` (draft) | M |
| L08b | UAT M17 (a) display constants shown next to computed figures; M17 (b) the "← Dashboard" link loops back to S2 (G5-M17 sweep, #113 6394014060). Not related to GAMIF-REF | #113 / 6394014060; 6400537203 (AM2-Dev5 M17 claim) | Amin2 (Dev5) | **Decided D32 (26 Oct), as recommended in the digest**: (a) goes into the docs in #367. An M02 seed change is still to do after go-live. (b) the "← Dashboard" loop is not covered by the answer (open) | #367 `6df647ac` (docs, draft); the M02 seed change has no PR yet | S |
| L09 | Q18 questions 1 to 3 (pre-night and VPS setup wording and steps) | #109 / 6399195617 rows 11-13 | Amin2 | **Decided D11 (26 Oct): Q18-1 yes, Q18-2 team domain, Q18-3 API-only**. LEAD asked Amin2 to update #321 to D11. D39 does not name #321 (merge coverage open) | `be/AM2-Q18-DOCS`, #321 `64bf4e38` (not draft) | S |
| L10 | REFERRAL-FU all/n: cap N=10 per 24 h, `coinsEnabled`, pending teacher. Open points: all vs n, and how a pending teacher is counted | #109 / 6399721389 | Amin2 | **Decided D29 (26 Oct): REFERRAL-FU "all"**; after go-live | `be/AM2-REFERRAL-FU`, #352 `728658e6` (draft; G4 APPROVE WITH MINORS per #109 / 6401621581) | M |
| L11 | N1 notice: reset wording vs AM-18 (A). Open items N4, N9, N10 | #317; #109 / 6399721389 | Amin2 | **Decided D20 (26 Oct): N1, IC text**. The notice must say users may be asked to change their password (matches D34), plus "Lupa kata laluan" for Google-only accounts. LEAD asked Amin2 to update #317 to this wording. D39 does not name #317 (merge coverage open) | `docs/AM2-NOTICE-P10` (adds `docs/ops/notice-28oct.md`), #317 `f6274e9e` (not draft) | S |
| L12 | Migrated accounts are still flagged `must_reset_password` by `decidePassword` in `apps/api/src/migration/transform/secrets.ts` (lines 23-55): non-bcrypt, shared default and roster accounts are flagged. Decide whether that forced reset stays after go-live | #109 / 6399369645 (reply "R39-C4: 1 / 2 / 3"; Amin1 recommends 2) | Amin1 (migration) / Amin2 (notice) — Perlu pengesahan | **Decided D34 (26 Oct): "R39-C4: 2"**. Code stays as it is; the notice is corrected (D20). The freeze exception for #226 + #357 is in group 0 | Related: `be/AM2-R39-no-must-reset`, `be/AM2-R39b-bootstrap-no-flag`; #226 and #357 (group 0) | M |
| L13 | M01 BUG-01: IC reset limit per address (5 per 15 min) can lock out a whole school behind one address | #113 / 6399706180 | Amin2 (BE) | **Decided D32 (26 Oct): "M01-B1: raise per-address"**; after go-live | `be/AM2-G5M01-b1-ic-reset-per-address`, #355 `ae1f294f` (draft; per-address limit 45 failures, per-account 5 kept, failure log; delta G4 APPROVE per #109 / 6401621581) | M |
| L14 | M01 BUG-07: notifications inbox not built; `/notifikasi` is 404 for a guest | #113 / 6399706180 | Amin2 | Open: M01 BUG-07, no LEAD answer yet. #109 / 6401621581 says likely "N/A D43" | n/a | L |

## 2. Code after go-live

Work with no open question. Merge only after the go-live freeze is lifted.

| ID | Item | Source | Owner | Waits on | Branch/PR | Size |
|---|---|---|---|---|---|---|
| C01 | M27 B5: S8 "Kod Kelas" clipped at 768 px; class table fits | #340 | Amin2 (Dev7) | - (go-live freeze) | `fe/AM2-G5M27-b5-b6`, #340 (draft) | S |
| C02 | M01 BUG-04: register and token server messages are in English; map to BM | #113 / 6399706180 | Amin2 (Dev6) | - | `fe/AM-G5M01-fixes`, #345 (draft; G4 REQUEST CHANGES, 6400161521 and 6400531767; Major fixes pushed at 704790e9, delta G4 pending) | S |
| C03 | M01 BUG-06: closed registration form stays usable until submit | #113 / 6399706180 | Amin2 (Dev6) | LEAD stats-flag contract M01-B06 (open; #109 6400830012). FE sits behind the optional `registrationOpen` | `fe/AM2-G5M01-b06`, #370 `efd85fc4` (draft) | S |
| C04 | M01 BUG-10: "Ingat saya" label misaligned | #113 / 6399706180 | Amin2 (Dev6) | - | dropped from #345 in 1c5ffb04; DS owner | S |
| C05 | Optional minor on #332: DV-M08-53/54 rows and a B7 `v-if` test | #332 | Amin2 | - | `fe/AM2-G5M08-b5-b7`, #332 | S |
| C06 | Optional minor on #335: doubled subtitle | #335 | Amin2 | LEAD M11-SUB (6400544380) | `fe/AM2-G5M11-layout-fixes`, #335 | S |
| C07 | Optional minor on #336: MobileCard padding, the `dl`, DV-M27-28 | #336 | Amin2 | - | `fe/AM2-G5M27-fixes`, #336 | S |
| C08 | Optional minor on #323: Remedial dialog 35 px; needs #324 DsDialog `xl` first | #323 | Amin2 | Half AZ merging #324 (H10) | `fe/AM2-G5M10-ccdialog-width`, #323 | S |
| C09 | Forced password change screen (AM2-A1): M01 part waits for the LEAD decision and the half-AZ patch | #226 | Amin2 | Merge now under D34, see E01 and E02 in group 0 (not after go-live) | `fe/AM2-A1-forced-password-change`, #226 (not draft) | M |
| C10 | Referral follow-up implementation once L10 is answered | #109 / 6399721389 | Amin2 | Decided D29 (26 Oct): "all" | `be/AM2-REFERRAL-FU`, #352 | M |
| C11 | #207 deploy-demo workflow | #207; #109 / 6406299561 (D5) | Amin2 | Decided D5 (26 Oct): deferred after go-live | #207 | S |
| C12 | M11 #4: kept as specified behaviour, no change | #113 / 6399292599; #109 / 6406299561 (D37) | - | Decided D37 (26 Oct): keep. Closed, listed for the record | n/a | - |
| C13 | M12 BUG-10 and BUG-07 | UAT findings list; #109 / 6406299561 (D38) | Amin2 | Decided D38 (26 Oct): after go-live, unless re-rated High | n/a | S |

## 3. Docs follow-ups

| ID | Item | Source | Owner | Waits on | Branch/PR | Size |
|---|---|---|---|---|---|---|
| D01 | M10 B6 (`/guru/live-kelas/cipta` redirect, D43), B7 (Tetapan Profil link hidden), B8 (scan error copy): spec and deviation notes | #341 | Amin2 (Dev7) | Review; merge after #247 | `docs/AM2-G5M10-spec-notes`, #341 | S |
| D02 | M01 BUG-03, BUG-05, BUG-08: deviation rows (credentials copy vs AC 01.4, `?redirect=` honoured, login field type) | #342 | Amin2 (Dev6) | Review and merge | `docs/AM-G5M01-deviations`, #342 | S |
| D03 | Q18 docs changes to `docs/ops/pre-night-28oct.md` and `docs/ops/vps-dark-setup-26oct.md` | `be/AM2-Q18-DOCS` | Amin2 | L09 decided (D11, 26 Oct) | `be/AM2-Q18-DOCS` | S |
| D04 | M08 B3 and M11-B5: update the module docs once the LEAD picks doc vs align | #109 / 6399195617 rows 6-7 | Amin2 | Decided D32 (26 Oct): B3 "doc" is #367; M11-B5 "filter" is code in #349 | #367 (B3 docs, draft) | S |
| D05 | N1 notice file `docs/ops/notice-28oct.md` and its docs index line | #317; `docs/AM2-NOTICE-P10` | Amin2 | L11 decided (D20, 26 Oct) | `docs/AM2-NOTICE-P10`, #317 (held for the LEAD) | S |
| D06 | Gamification reference-data note in the docs after the L08 answer | #307 | Amin2 | L08 decided (D28, 26 Oct) | `be/AM2-GAMIF-REF-reference-catalogue` | S |
| D07 | #308 docs draft (AM2-Dev4), stacked on #260 | #308 | Amin2 (Dev4) | Retarget after #310 merges | #308 (draft, stacked on #260) | S |

## 4. Half-AZ shared-file proposals

These touch shared files (`src/api`, `src/ds`, shell, compose, lint config). Amin2 only proposes the patch; half AZ decides and merges. Source for the group: #113 / 6399362730.

| ID | Item | Source | Owner | Waits on | Branch/PR | Size |
|---|---|---|---|---|---|---|
| H01 | #276: High chapter quiz returns 404 (chapter quiz matches string chapter ids, SW13-01) | #276 | Half AZ | Merge decision | `fe/AM2-SW13-01-chapter-id`, #276 (draft) | S |
| H02 | #275: ids on the wire as strings in http mode (SWY-01..07b) | #275 | Half AZ | Merge decision | `fe/AM2-SWY-id-wire`, #275 (draft) | M |
| H03 | #281: map the API's generic English envelope messages to BM in http mode (SWE central) | #281 | Half AZ | Merge decision | `fe/AM-SWE-central-api-errors`, #281 (draft) | M |
| H04 | #334: card values wrap instead of "..."; confirm dialog shows its message once (M27 B1, B6, B9) | #334 | Half AZ | Merge decision | `ds/AM2-card-wrap-confirm-proposal`, #334 (draft) | S |
| H05 | #312: `lint:ds` allows wrap-anywhere (DsStatTile at 375 px) | #312 | Half AZ | Merge decision | `fe/AM2-PP-lintds-wrap-anywhere`, #312 (draft) | S |
| H06 | #329: Pentadbiran "Monitoring" points at `/admin/monitoring` and is active there (M11 bug 9) | #329 | Half AZ | Merge decision | `shell/AM2-pm03-admin-monitoring-proposal`, #329 (draft) | S |
| H07 | #333: Pembelajaran topbar shows a page-provided title (M08 B4) | #333 | Half AZ | Merge decision | `fe/AM2-PP-G5M08-b4-shell-title`, #333 (draft) | S |
| H08 | #309: `compose.http` raises the global throttle and runs the job worker (e2e-http) | #309 | Half AZ | Merge decision | `fe/AM2-PP-e2e-http-env`, #309 (draft) | S |
| H09 | #344: keep the server's BM 429 copy in http mode (M01 BUG-02) | #344 | Half AZ | Merge decision | `fe/AM-G5M01-B2-429-copy`, #344 (draft) | S |
| H10 | #324: DsDialog `xl` size (unblocks C08 and possibly L05) | #324 | Half AZ | Merge decision (unblocks C08 and possibly L05) | `ds/AM2-dsdialog-xl-proposal`, #324 (draft) | S |
| H11 | #226: half-AZ part of the forced password change screen | #226 | Half AZ | Merged under the D34 exception (group 0), no longer after go-live | `fe/AM2-A1-forced-password-change`, #226 (not draft) | M |
| H12 | UAT items with no PR yet: M08 B6 and B8 (not defects per #368), M11 7 (DsChart fractional ticks, now #368), M27 B3 (shell title ellipsised at 375), M27 B10 (shell text below 12 px), M27 B11 (sidebar user card cuts name), M01 BUG-09 (role mismatch: redirect vs Akses Ditolak) | UAT findings list | Half AZ | Half AZ to open proposals | M11-7 in #368; the rest n/a **Perlu pengesahan** | M |
| H13 | M11-7 DsChart integer ticks. #368 also covers M08 B6/B8 "if real"; per #368 and the LEAD digest, M08 B6/B8 are not defects | #368 | Half AZ | Merge decision | `fe/AM2-patch-ds-m11-m08`, #368 `a6f77279` (draft patch proposal) | S |
| H14 | M10 B4: teacher remedial quiz links open the M05 preview instead of bouncing to `/guru` (`prototype-scope.ts` is a half-AZ file) | #369; D32 (26 Oct) | Half AZ | Decided D32 "patch"; merge decision after go-live | `fe/AM2-G5M10-b4-remedial-scope`, #369 `c308454c` (draft) | S |

## Suggested order after go-live

0. Merge #226 and #357 (group 0) under the D34 exception once the LEAD allows; this is not after go-live.
1. Ask the LEAD the items in group 1 that are still open: M01 BUG-07 (L14), the M01-B06 stats flag (C03), the M02 BUG-06 24 px gap (L05), the M02 BUG-01 personal-data point (L04), M17 (b) (L08b) and D39 coverage for #317 and #321. All other group 1 items are decided (D11, D20, D28, D29, D32, D34 on 26 Oct).
2. Merge the docs PRs #341 and #342 (D01, D02); they are low risk and need only review.
3. Ask half AZ to review the proposals in group 4. Start with #324 (H10), because C08 and L05 depend on it, then #329, #333 and #334.
4. Do the small FE items that need no decision: C01 (#340), C04, C03, C02.
5. Do the optional minors on #332, #335, #336 and #323 (C05 to C08) as one cleanup pass.
6. Build the items unlocked by the LEAD answers: C10 (referral), C09 (forced password change), L14 (notifications inbox) last because it is the largest.
7. Update the docs (D03 to D06) as each decision lands, and record each fix in the module's fidelity deviation table.
