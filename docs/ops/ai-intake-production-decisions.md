# AI intake in production: decisions for the 30 Oct go-live (AZ-29)

Status: **decided** by the LEAD DECISION on #113 of 22 Oct 2026, 10:30 MYT (the LEAD may override any line):
`AZ-29: 1 MOCK, 2 -, 3 -, 4 OFF, 5 KEEP, 6 LATER, 7 ADMIN`. The record, the production values and the follow-ups are
in the [decision record](#decision-record-22-oct-2026) below; the option tables after it are kept as the reasoning.
No secret values are in this file; env names only.

Scope: the PC-5 lane (BE-36 AI extraction, BE-37 files/OCR/jobs, BE-38 intake workflow, BE-40 dashboard and budget),
running on the production VPS from the AZ-09 pack (#116). Sources: `docs/architecture/v2-backend-plan.md` OD-14..OD-16
(section 13) and section 15, `docs/requirements/v2-backend-urs.md` BE-NFR-14, -30, -31..35, `docs/ops/go-live-bijak-spm.md`
D-5, D-6 and the env table, `.env.api.example` (PC-5 block), `apps/api/src/common/config/env.schema.ts`, and the code
on `feature/v2-backend` @ `23c98226`.

> **Naming.** The repo has no written list of `DEC-nn` ids. In this file **DEC-07 is read as "the AI/PC-5 production
> questions"**: OD-14 (provider, region, cap; go-live D-5) plus the intake gaps below. OD-15 is the OCR engine and
> OD-16 the intake limits and retention, as defined in the backend plan. If the LEAD's DEC-07 means something else,
> the answers below still stand on their own; only the label changes.

## Decision record (22 Oct 2026)

| # | Item | Answer | Production value (`/etc/pretasiplus/api.env`; names and non-secret values only) | Follow-up |
|---|---|---|---|---|
| 1 | AI provider (OD-14, D-5) | **MOCK** | `AI_PROVIDER=mock`; `AI_MODEL`, `AI_API_KEY`, `AI_MONTHLY_BUDGET_SEN`, `AI_PRICE_TABLE_JSON` stay **unset** | Revisit in week 2 with real papers. A paid provider needs a new LEAD decision and the gates of items 2 and 3 |
| 2 | Monthly AI cap | **n/a** (item 1 is MOCK) | none | Decided together with any future provider |
| 3 | Region of the redacted text | **n/a** (item 1 is MOCK) | none | Before any real provider: a PDPA cross-border check, a vendor DPA (no training, no retention) and BE-38 switched to the BE-36 redactor (#85/#78) |
| 4 | OCR engine (OD-15) | **OFF** | `OCR_ENGINE=none`; `OCR_LANG_DIR` unset; no tessdata volume in the compose overlay | Scanned pages show `OCR_UNAVAILABLE` and are typed in by hand. TJS only after one timed run of 20 real scans on the VPS (week 2), by a new decision |
| 5 | Intake limits (OD-16) | **KEEP** | no keys set, so the schema defaults apply (`INTAKE_MAX_FILE_MB` 20, `OCR_MAX_PAGES` 200, `INTAKE_MAX_FILES_PER_BATCH` 10, `INTAKE_DAILY_PAGE_QUOTA` 500, `INTAKE_MAX_ACTIVE_BATCHES` 5, `INTAKE_MAX_ITEMS_PER_BATCH` 500); edge `PP_UPLOAD_FILES_MB=22`, `PP_UPLOAD_BIG_MB=256` in `prod.env` | `LEAD: confirm` with one real scanned paper that it fits 20 MB / 200 pages |
| 6 | Retention of intake files (BE-NFR-14) | **LATER** | none (`INTAKE_RETENTION_MONTHS` does not exist yet) | PC-5 card by the end of Q1 2027 (env key and daily purge job). Until then intake files and page images are kept with no purge, also in backups; the production runbook (#116 follow-up) has a manual step for an erasure request |
| 7 | Who may use intake | **ADMIN** | the flag that card AZ-35 adds (admin-only is its default) | **AZ-35** (AZ-Dev1, claimed on #113): intake upload and processing routes for `admin` only, behind a flag; a teacher gets 403. **Go-live blocker:** without it, teachers can upload unscanned files on 30 Oct. ALL would need ClamAV (#78) or a recorded LEAD risk acceptance |

Effect at go-live: intake has **no external AI, no OCR and no teacher access**, and no intake data leaves the server.
Revisit items 1, 4 and 7 in week 2.

Where the values live: `deploy/vps/api.env.example` and `docs/ops/production-vps.md` section 3 (the #116 follow-up
F-DEFAULTS). `docs/ops/go-live-bijak-spm.md` D-5 is marked answered by whoever next edits that file; it is not edited
here.

## What is true on the tip today

| Fact | Where |
|---|---|
| `AI_PROVIDER` defaults to `mock`. The mock is a deterministic **heuristic parser** of well-formatted paper text (port of the prototype's `parsePaper`): no network, no key, no cost. It reads `1. Stem [2 markah]`, `A. option`, `Jawapan: 1-B`, `Skema 3(a)` layouts; anything else comes out as low-confidence items or warnings for manual review. | `ai.config.ts`, `providers/mock/mock-parser.ts` |
| Real adapters exist: `anthropic`, `openai`, `gemini`, `openai-compatible`. An unknown id stops the API at start-up. | `providers/registry.ts`, `@pp/contract` `AI_PROVIDER_IDS` |
| A paid provider is **not configured** (fail closed: `AI_UNAVAILABLE`, status `configured:false`) unless `AI_MODEL` is set, `AI_PRICE_TABLE_JSON` prices that model, and a monthly cap exists (`AI_MONTHLY_BUDGET_SEN`, or an admin setting). | `ai.config.ts`, `pricing.ts`, `ai-budget.service.ts` |
| The provider receives **redacted OCR/text-layer text only, never page images** (LEAD decision (c), 2026-10-21). | go-live doc row "Intake workflow", BE-38 |
| `OCR_ENGINE` defaults to `none`: text-layer PDFs work; **scanned pages end as `OCR_UNAVAILABLE`**. `tesseract` needs `OCR_LANG_DIR` with `msa.traineddata` and `eng.traineddata`; the api image ships **no** language data and never downloads it. | `env.schema.ts` 157-160, `docker/api/Dockerfile` |
| Intake routes allow **`teacher` and `admin`** (`@Roles('teacher', 'admin')`). The dashboard is admin only. There is no virus scan of uploads yet (ClamAV is backlog #78; the AZ-09 compose has a ready `clamav` profile). | `intake-files.controller.ts:78`, `intake-workflow.controller.ts:53` |
| **Retention is not implemented.** OD-16 / BE-NFR-14 say "keep while the batch is open and 12 months after publish" (`INTAKE_RETENTION_MONTHS`), but no such env var and no purge job exist. Intake files stay until deleted by hand. | grep of `apps/api/src` (no retention code in `intake/`, `files/`, `jobs/`) |
| Limits in force (defaults): `MAX_UPLOAD_MB` 10, `INTAKE_MAX_FILE_MB` 20, `OCR_MAX_PAGES` 200, `INTAKE_MAX_FILES_PER_BATCH` 10, `INTAKE_MAX_ACTIVE_BATCHES` 5 (per teacher; admin exempt), `INTAKE_DAILY_PAGE_QUOTA` 500 (per user per Malaysia day; admin exempt), `INTAKE_MAX_ITEMS_PER_BATCH` 500, `OCR_WORKERS` 2, `OCR_WORKER_MEMORY_MB` 256. The VPS edge fences these with `PP_UPLOAD_FILES_MB` 22 and `PP_UPLOAD_BIG_MB` 256. | `.env.api.example`, `deploy/vps/.env.prod.example` (#116) |

## The decisions

Answer format on #113: `AZ-29: 1 MOCK, 2 -, 3 -, 4 OFF, 5 KEEP, 6 LATER, 7 ADMIN` (one word per item; `-` = not
applicable or "use the default"; items 2 and 3 are not applicable while item 1 is MOCK). This is the answer the
LEAD gave on 22 Oct.

### 1. AI provider for production intake (OD-14, go-live D-5)

| Option (word) | What it means | Cost | Risk |
|---|---|---|---|
| **MOCK** | `AI_PROVIDER=mock`. Text-layer PDFs in the known layout are parsed by the heuristic; everything else is reviewed or typed in the builder. | RM 0 | Low extraction quality on unusual layouts (more manual review). No data leaves the server. |
| ANTHROPIC / OPENAI / GEMINI | That vendor's adapter, `AI_MODEL` + `AI_API_KEY` + price entry + cap. | Per token, capped by item 2. Budget anchor in the plan (NFR-03): about RM 2.00 per 40-question paper. The LEAD fills current list prices into `AI_PRICE_TABLE_JSON`. | A new data processor (redacted paper text only, item 3). Key handling on the VPS. Vendor outage → `AI_UNAVAILABLE`, intake falls back to manual. |
| COMPAT | `openai-compatible` through a gateway (`AI_BASE_URL`, host in `AI_BASE_URL_ALLOWLIST`). | As above, plus the gateway's fee. | As above, plus one more party in the path. |

**Default: MOCK for 30 Oct**, revisit after week 1 with real papers (the same timing as the Sentry decision). It adds
no data processor and no spend on launch week, and the review UI already handles low-confidence output. Who loads
the launch papers (D-6) is still open; with MOCK they are built or corrected by hand in the paper builder.

Env: `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY` (secret, server env only), `AI_BASE_URL`, `AI_BASE_URL_ALLOWLIST`,
`AI_PRICE_TABLE_JSON`, `AI_TIMEOUT_MS`, `AI_MAX_CONCURRENCY`, `AI_RATE_LIMIT_PER_MIN`, `AI_RATE_LIMIT_PER_USER_PER_MIN`,
`AI_RATE_LIMIT_PER_SCHOOL_PER_MIN`, `AI_MAX_RETRIES`, `AI_RETRY_BASE_MS`, `THROTTLE_AI_READ_PER_MINUTE`,
`THROTTLE_AI_WRITE_PER_MINUTE`, `INTAKE_EXTRACTS_PER_MINUTE`, `INTAKE_EXTRACT_BUDGET_RECHECK_SECONDS`.

### 2. Monthly AI cap (only if item 1 is not MOCK)

| Option | `AI_MONTHLY_BUDGET_SEN` | Roughly (at the RM 2.00/paper anchor) |
|---|---|---|
| **R100** | `10000` | about 50 papers a month |
| R50 | `5000` | about 25 papers |
| R300 | `30000` | about 150 papers |

**Default: R100.** The cap is shared across API processes through the database; the per-minute limits are per process
(the VPS runs one API instance). When the cap is reached, extraction waits (`INTAKE_EXTRACT_BUDGET_RECHECK_SECONDS`)
and Admin Pusat is notified; nothing is lost. An admin can change the cap later in the AI settings screen.

### 3. Where the redacted text may go (only if item 1 is not MOCK)

| Option | Meaning | Risk |
|---|---|---|
| **ANY** | The vendor's standard API region (usually outside Malaysia). | Cross-border transfer of question-paper text after redaction. The text is exam content, not pupil records, but scans can carry a teacher's or pupil's name; the redactor removes the patterns it knows. The LEAD should check this against the PDPA cross-border rules; this is not legal advice. |
| APAC | Only a provider or gateway with an Asia-Pacific endpoint (usually through `openai-compatible`). | Fewer choices, possibly higher price. |

**Default: ANY**, with the redactor follow-up from #85 / #78 (BE-38 to use BE-36's redactor) done before the first
real call.

### 4. OCR engine (OD-15)

| Option | What it takes | Cost | Risk |
|---|---|---|---|
| **OFF** | `OCR_ENGINE=none` (as today). | None | Scanned PDFs cannot be read; their pages show `OCR_UNAVAILABLE` and are typed in by hand. |
| TJS | `OCR_ENGINE=tesseract` + `OCR_LANG_DIR=/opt/tessdata` (a read-only volume with `msa.traineddata` and `eng.traineddata`, fetched once by the LEAD from the tesseract `tessdata` project, Apache-2.0). An ops change in the AZ-09 compose (one volume, two env lines); no code change. | CPU and memory: up to `OCR_WORKERS` (2) threads of `OCR_WORKER_MEMORY_MB` (256) each on the API container; a scan page takes seconds, `OCR_PAGE_TIMEOUT_MS` 30 s. | Slower intake on a small VPS while teachers practise. Needs a throughput check on real scans (plan OD-15). |
| NATIVE | poppler + tesseract binaries in the api image. | Image change + code change. | Not built; not before go-live. |

**Default: OFF for 30 Oct, TJS in week 2** after one measured run of 20 real scanned pages on the VPS. Reason: the VPS
size is still open (#116 decision 1) and OCR is the heaviest CPU path; text-layer PDFs (the usual source of
publisher and teacher papers) work without it.

Env: `OCR_ENGINE`, `OCR_LANG_DIR`, `OCR_WORKERS`, `OCR_PAGE_TIMEOUT_MS`, `OCR_INSPECT_TIMEOUT_MS`, `OCR_RENDER_DPI`,
`OCR_MAX_PIXELS`, `OCR_WORKER_MEMORY_MB`, `OCR_WORKER_RSS_LIMIT_MB`, `OCR_MIN_TEXT_CHARS`, `INTAKE_UPLOAD_CONCURRENCY`.

### 5. Intake limits (OD-16, sizes and quotas)

| Option | Values |
|---|---|
| **KEEP** | The defaults in the table above (20 MB per file, 200 pages, 10 files per batch, 500 pages per user per day, 5 open batches per teacher, 500 items per batch). Edge: `PP_UPLOAD_FILES_MB=22`, `PP_UPLOAD_BIG_MB=256`. |
| LOWER | For a small VPS: `INTAKE_MAX_FILE_MB=10`, `OCR_MAX_PAGES=100`, `INTAKE_DAILY_PAGE_QUOTA=200`, `INTAKE_MAX_FILES_PER_BATCH=5`; edge `PP_UPLOAD_FILES_MB=12`, `PP_UPLOAD_BIG_MB=64`. |

**Default: KEEP.** A full SPM paper with its scheme is expected to fit well inside 20 MB and 200 pages (`LEAD: confirm`
with one real scanned paper), the limits are already the plan's defaults and every one is enforced server-side. Change only together with the edge values.

Env: `MAX_UPLOAD_MB`, `INTAKE_MAX_FILE_MB`, `OCR_MAX_PAGES`, `INTAKE_MAX_FILES_PER_BATCH`, `INTAKE_MAX_ACTIVE_BATCHES`,
`INTAKE_DAILY_PAGE_QUOTA`, `INTAKE_MAX_ITEMS_PER_BATCH`, `INTAKE_WRITES_PER_MINUTE`, `INTAKE_READS_PER_MINUTE`,
`INTAKE_REVIEW_WRITES_PER_MINUTE`, `INTAKE_REVIEW_READS_PER_MINUTE`, `INTAKE_BULK_PER_MINUTE`,
`INTAKE_BULK_ACCEPT_MIN_BAND`, `INTAKE_DUPLICATE_SCAN_LIMIT`, `UPLOAD_RATE_PER_MINUTE`; edge `PP_UPLOAD_FILES_MB`,
`PP_UPLOAD_BIG_MB`.

### 6. Retention of intake files and page images (OD-16, BE-NFR-14)

| Option | Meaning | Risk |
|---|---|---|
| **LATER** | Go live without the purge job. The first file could only expire 12 months after its batch is published (Oct 2027 at the earliest), so nothing is overdue before then. A half-AZ PC-5 card adds `INTAKE_RETENTION_MONTHS` (default 12) and a daily purge job, target end of Q1 2027. Until then the backups also hold the files (AZ-09 retention: 7 daily, 4 weekly). | A promise in the URS that the code does not keep yet; documented here. |
| BUILD | The same card, but before 30 Oct. | Takes a PC-5 developer away from go-live fixes for no effect before 2027. |
| SHORT | As BUILD, with a shorter period (for example 3 months). | As BUILD. |

**Default: LATER.** Env (to be added by that card): `INTAKE_RETENTION_MONTHS`.

### 7. Who may use intake at go-live

| Option | Meaning | Risk |
|---|---|---|
| **ADMIN** | Admin Pusat only until ClamAV (#78) scans uploads. Needs one small PC-5 change (intake upload and batch routes `@Roles('admin')` behind a flag, for example `INTAKE_TEACHER_ENABLED=false`) or, at least, the teacher menu entry hidden. | Teachers cannot upload their own papers on launch day. |
| ALL | Teachers and Admin Pusat, as the code allows today. | Teacher uploads are parsed by pdfjs in bounded workers (BE-NFR-30: scripting off, page and size caps, timeouts) but **not virus-scanned**; a recorded LEAD risk acceptance is needed (as #116 decision 6 says). |

**Default: ADMIN**, consistent with #116 decision 6. The go-live doc lists intake as an Admin Pusat screen, but it
does not exclude teachers, so it is not cited as a rule here. If the LEAD answers ADMIN, half AZ opens the small PC-5
card (a code change, needed before 30 Oct); if ALL, the LEAD writes the risk acceptance on #113.

## After the answers

State for the 22 Oct answer: step 1 is done (LEAD DECISION on #113); step 2 is the #116 follow-up F-DEFAULTS (no TJS
volume, because item 4 is OFF); step 3 is AZ-35 for item 7, the retention card stays planned for Q1 2027, and the
redactor follow-up is not needed while item 1 is MOCK; step 4 is open.

1. LEAD posts the one-line answer on #113.
2. AZ-DevOps writes the chosen values into `deploy/vps/.env.prod.example` / `api.env.example` comments and the
   production runbook (#116 follow-up), and adds the TJS volume to the AZ-09 compose if item 4 is TJS.
3. Cards for half AZ (PC-5), only if chosen: teacher-intake flag (item 7 ADMIN), retention job (item 6), redactor
   follow-up (#85/#78, before any paid provider).
4. `docs/ops/go-live-bijak-spm.md` D-5 is marked answered, with a link here.
