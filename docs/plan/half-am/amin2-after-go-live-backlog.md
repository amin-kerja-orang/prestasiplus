# Amin2 after-go-live backlog

| | |
|---|---|
| Status | Draft, 26 Oct 2026 |
| Owner | Half AM (Amin2) |
| Go-live | 30 Oct 2026 |
| Purpose | One list of every Amin2 item deferred until after go-live, so the LEAD and the team can schedule it. For each item: source, owner, the LEAD decision it waits on, and its current branch or PR. |

How to read it:

- **Source** is a GitHub comment id or a PR number. UAT finding ids (`M02 BUG-01`, `M10 B1`) come from the UAT findings list kept by half AM (not committed to the repo).
- **Waits on** names the LEAD decision. `-` means no decision is needed; the item only needs time.
- **Branch/PR** is the head branch and PR as last seen on origin. `n/a` means no branch exists yet. Items marked **Perlu pengesahan** could not be verified from git or the PR list and must be confirmed before scheduling.
- **Size**: S under half a day, M up to two days, L more. These are estimates, not commitments.
- Owner "Half AZ" means the file is a shared file and Amin2 only proposes the patch (see group 4).
- No secrets, real names or real data counts are listed here, by project rule.

## 1. LEAD decisions

Items that cannot start until the LEAD answers. Questions were raised on #109 (comments 6399195617 and 6399721389) and #113 (comment 6399706180).

| ID | Item | Source | Owner | Waits on | Branch/PR | Size |
|---|---|---|---|---|---|---|
| L01 | M10 B1: admin gets "Gagal memuatkan" on `/guru/kelas`; drop the admin from that route or give admin a view | #109 / 6399195617 | Amin2 | Drop admin from the route? | n/a (no branch) **Perlu pengesahan** | S |
| L02 | M10 B2: class-create school picker offers any school; restrict to the teacher's own school | #109 / 6399195617 | Amin2 | Own school only? | n/a | S |
| L03 | M10 B4: teacher remedial link goes to `/guru`; patch the link target | #109 / 6399195617 | Amin2 | Patch or keep | n/a | S |
| L04 | M02 BUG-01: renewal invoice table empty; contract needs `students[]` | #109 / 6399195617 | Amin2 (FE) with BE | Add `students[]` to the contract? | n/a | M |
| L05 | M02 BUG-06: forms are two columns at 640-767 px and the modal is 512 px | #109 / 6399195617 | Amin2 | Keep live behaviour or fix | n/a (related: #323, #324) | S |
| L06 | M08 B3: S6/S19/S20 read different sources; align the code or change the doc | #109 / 6399721389 | Amin2 | Doc vs align | n/a | M |
| L07 | M11-B5: S2 counts vs the S3/S5 minimisation filter; change the filter or the doc | #109 / 6399721389 | Amin2 | Filter vs doc | n/a | M |
| L08 | #307 GAMIF-REF (a)(b)(c): gamification catalogue as reference data, ETL adopts seeded challenges. UAT M17 (a) display constants next to computed figures and M17 (b) dashboard back link loops to S2 are also waiting on the LEAD; **Perlu pengesahan** whether M17 (a)/(b) are the same as GAMIF-REF (a)/(b) | #307; #109 / 6399721389 | Amin2 | Options (a), (b), (c) | `be/AM2-GAMIF-REF-reference-catalogue`, #307 (draft) | M |
| L09 | Q18 questions 1 to 3 (pre-night and VPS setup wording and steps) | #109 / 6399721389 | Amin2 | Answers to Q18 1 to 3 | `be/AM2-Q18-DOCS` (no PR seen) **Perlu pengesahan** | S |
| L10 | REFERRAL-FU all/n: cap N=10 per 24 h, `coinsEnabled`, pending teacher. Open points: all vs n, and how a pending teacher is counted | #109 / 6399721389 | Amin2 | all vs n; the cap and coin rules | `be/AM2-REFERRAL-FU` (no PR seen) **Perlu pengesahan** | M |
| L11 | N1 notice: reset wording vs AM-18 (A) | #109 / 6399721389 | Amin2 | Which wording wins | `docs/AM2-NOTICE-P10` (adds `docs/ops/notice-28oct.md`) | S |
| L12 | Migrated accounts are still flagged `must_reset_password` by `decidePassword` in `apps/api/src/migration/transform/secrets.ts` (lines 23-55): non-bcrypt, shared default and roster accounts are flagged. Decide whether that forced reset stays after go-live | #109 / 6399721389 | Amin2 with BE | Keep or relax the flag | Related: `be/AM2-R39-no-must-reset`, `be/AM2-R39b-bootstrap-no-flag`, #226 | M |
| L13 | M01 BUG-01: IC reset limit per address (5 per 15 min) can lock out a whole school behind one address | #113 / 6399706180 | Amin2 (BE) | New limit rule | n/a | M |
| L14 | M01 BUG-07: notifications inbox not built; `/notifikasi` is 404 for a guest | #113 / 6399706180 | Amin2 | Build now (new scope) or drop | n/a | L |

## 2. Code after go-live

Work with no open question. Merge only after the go-live freeze is lifted.

| ID | Item | Source | Owner | Waits on | Branch/PR | Size |
|---|---|---|---|---|---|---|
| C01 | M27 B5: S8 "Kod Kelas" clipped at 768 px; class table fits | #340 | Amin2 (Dev7) | - (go-live freeze) | `fe/AM2-G5M27-b5-b6`, #340 (draft) | S |
| C02 | M01 BUG-04: register and token server messages are in English; map to BM | #113 / 6399706180 | Amin2 (Dev6) | - | n/a **Perlu pengesahan** | S |
| C03 | M01 BUG-06: closed registration form stays usable until submit | #113 / 6399706180 | Amin2 (Dev6) | - | n/a | S |
| C04 | M01 BUG-10: "Ingat saya" label misaligned | #113 / 6399706180 | Amin2 (Dev6) | - | n/a | S |
| C05 | Optional minor on #332: DV-M08-53/54 rows and a B7 `v-if` test | #332 | Amin2 | - | `fe/AM2-G5M08-b5-b7`, #332 | S |
| C06 | Optional minor on #335: doubled subtitle | #335 | Amin2 | - | `fe/AM2-G5M11-layout-fixes`, #335 | S |
| C07 | Optional minor on #336: MobileCard padding, the `dl`, DV-M27-28 | #336 | Amin2 | - | `fe/AM2-G5M27-fixes`, #336 | S |
| C08 | Optional minor on #323: Remedial dialog 35 px; needs #324 DsDialog `xl` first | #323 | Amin2 | Half AZ merging #324 (H10) | `fe/AM2-G5M10-ccdialog-width`, #323 | S |
| C09 | Forced password change screen (AM2-A1): M01 part waits for the LEAD decision and the half-AZ patch | #226 | Amin2 | Same decision as L12 | `fe/AM2-A1-forced-password-change`, #226 (draft) | M |
| C10 | Referral follow-up implementation once L10 is answered | #109 / 6399721389 | Amin2 | L10 | `be/AM2-REFERRAL-FU` | M |

## 3. Docs follow-ups

| ID | Item | Source | Owner | Waits on | Branch/PR | Size |
|---|---|---|---|---|---|---|
| D01 | M10 B6 (`/guru/live-kelas/cipta` redirect, D43), B7 (Tetapan Profil link hidden), B8 (scan error copy): spec and deviation notes | #341 | Amin2 (Dev7) | Review and merge | `docs/AM2-G5M10-spec-notes`, #341 | S |
| D02 | M01 BUG-03, BUG-05, BUG-08: deviation rows (credentials copy vs AC 01.4, `?redirect=` honoured, login field type) | #342 | Amin2 (Dev6) | Review and merge | `docs/AM-G5M01-deviations`, #342 | S |
| D03 | Q18 docs changes to `docs/ops/pre-night-28oct.md` and `docs/ops/vps-dark-setup-26oct.md` | `be/AM2-Q18-DOCS` | Amin2 | L09 | `be/AM2-Q18-DOCS` | S |
| D04 | M08 B3 and M11-B5: update the module docs once the LEAD picks doc vs align | #109 / 6399721389 | Amin2 | L06, L07 | n/a | S |
| D05 | N1 notice file `docs/ops/notice-28oct.md` and its docs index line | `docs/AM2-NOTICE-P10` | Amin2 | L11 | `docs/AM2-NOTICE-P10` | S |
| D06 | Gamification reference-data note in the docs after the L08 answer | #307 | Amin2 | L08 | `be/AM2-GAMIF-REF-reference-catalogue` | S |

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
| H10 | #324: DsDialog `xl` size (unblocks C08 and possibly L05) | #324 | Half AZ | Merge decision | `ds/AM2-dsdialog-xl-proposal`, #324 (draft) | S |
| H11 | #226: half-AZ part of the forced password change screen | #226 | Half AZ | L12 | `fe/AM2-A1-forced-password-change`, #226 (draft) | M |
| H12 | UAT items with no PR yet: M08 B6 and B8 (DS notes), M11 7 (DsChart fractional ticks), M27 B3 (shell title ellipsised at 375), M27 B10 (shell text below 12 px), M27 B11 (sidebar user card cuts name), M01 BUG-09 (role mismatch: redirect vs Akses Ditolak) | UAT findings list | Half AZ | Half AZ to open proposals | n/a **Perlu pengesahan** | M |

## Suggested order after go-live

1. Ask the LEAD the questions in group 1 in one sitting. L12, L10, L08 and L13 have the most effect on data and security, so they come first.
2. Merge the docs PRs #341 and #342 (D01, D02); they are low risk and need only review.
3. Ask half AZ to review the proposals in group 4. Start with #324 (H10), because C08 and L05 depend on it, then #329, #333 and #334.
4. Do the small FE items that need no decision: C01 (#340), C04, C03, C02.
5. Do the optional minors on #332, #335, #336 and #323 (C05 to C08) as one cleanup pass.
6. Build the items unlocked by the LEAD answers: C10 (referral), C09 (forced password change), L14 (notifications inbox) last because it is the largest.
7. Update the docs (D03 to D06) as each decision lands, and record each fix in the module's fidelity deviation table.
