# UAT: Terbit papers dry-run report (U-OP-04 / 08 / 09)

Card S3-T08. Script: `apps/api/scripts/uat-ops/terbit-papers.ts`. Test: `apps/api/test/uat-ops/terbit-papers.spec.ts`.

## Purpose

Before an admin publishes the launch papers, this report shows, per launch paper, whether "Jana set" would succeed under its Kontrak and why not. It supports:

- U-OP-04 (Kontrak Disahkan): which Kontrak exist and their source (Spec, Disahkan, Draf).
- U-OP-08 (pool for blueprint papers): whether the Terbit question pool is enough (eligible and published totals, first shortage).
- U-OP-09 (Terbit papers in Set Builder): the order to work through, and which papers are ready.

The tool is **read-only**. It sends one login POST and then GET requests only. It never calls `POST /api/admin/papers`, `/api/admin/papers/generate` or any publish route, and has no `--apply` (passing it is a usage error, exit 2). The real Terbit is done by the designated UAT developer or an admin in Set Builder, only after the user confirms the report (D110). No AI session acts on a server.

## Environment variables (names only; values stay in your shell or the platform secret store, never in the repo)

| Name | Meaning |
|---|---|
| `UAT_API_URL` | Base URL of the UAT API (required, no default). |
| `UAT_ADMIN_EMAIL` | Login identifier of an Admin Pusat account (sent as `identifier`). |
| `UAT_ADMIN_PASSWORD` | Its password. |

## Run

```
UAT_API_URL=... UAT_ADMIN_EMAIL=... UAT_ADMIN_PASSWORD=... npm run be:uat:terbit-papers
```

The script logs in through `POST /api/auth/login`, keeps the session cookie, reads all pages of `GET /api/admin/blueprints`, and for each launch paper that has a Kontrak reads `GET /api/admin/papers/pool-preview?subject={code}&kertas={n}`. The app subject code (for example the one used by the pool preview) is taken from the `subject` field of the blueprint list; the SPM paper code (`3472/2`) is the list's `code` field. Nothing is guessed. If the admin account must change its password, the script stops with `PASSWORD_CHANGE_REQUIRED` (exit 2): change it in the app and run again.

Launch list, in this order: 3472/2, 1449/1, 1249/1, 4531/1, Sains K1, 1449/2, 3472/1, 4531/2, 1249/2. "Sains K1" is the Kontrak whose subject name is exactly `Sains` with kertas 1. A launch paper without a Kontrak prints `no contract`.

## Reading the report

A table is printed, and the same data is written under `.evidence/uat-ops/` (gitignored): `terbit-papers-<timestamp>.txt` and `terbit-papers-<timestamp>.csv`. The files hold codes and counts only.

| Column | Meaning |
|---|---|
| `code`, `kertas` | SPM paper code and paper number. |
| `source` | Spec, Disahkan or Draf, from the Kontrak head. |
| `servingVersion` | Version students generate from; empty when none serves. |
| `verdict` | `boleh`, `tidak_boleh` or `tidak_pasti`, as the pool preview returned it. |
| `firstFailure` | First shortage in BM (same wording as the app); empty when none. In the CSV and `.txt` only. |
| `eligibleTotal`, `publishedTotal` | Eligible and Terbit question counts of the subject. |
| `wouldCreate` | `yes` only when verdict is `boleh` and source is Spec or Disahkan; otherwise `no`, with `reason` (`verdict tidak_boleh`, `source Draf`, `no contract`). |

Exit codes: 0 report produced (one INFO line per paper, `no` rows are not failures), 1 a FAIL line (login failed, blueprint list or a pool preview could not be read), 2 usage or environment error.

## Next steps after the report

1. The user reviews the report (`approve U-OP-09`).
2. Papers with `wouldCreate = yes` are generated and published in Set Builder by the UAT developer or an admin. Papers with `no`: fix the cause first (add a Kontrak, verify a Draf, or seed the pool through Import & Semakan, U-OP-08), then re-run the report.
3. Verify manually as a T5 pupil that Bijak SPM lists the papers.
