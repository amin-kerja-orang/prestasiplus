# UAT environment changes for the R1 rebuild release (T-A6)

Scope: what must change on `uat.prestasiplus.cloud` (187.52.120.11) compared with the release running there now (`e34e0a52d515`, deployed 3 Nov 2026). Names and intended non-secret values only. No secret value is written here or may be copied into the repo. Read on 10 Nov 2026 over SSH, read-only: variable NAMES of the env files, plus the values of non-secret keys.

Files on the host (`/etc/pretasiplus/`, root:ppdeploy, mode 640): `api.env`, `db.env`, `etl.env`, `migrate.env`, `prod.env`. Templates: `deploy/vps/api.env.example`, `deploy/vps/.env.prod.example`, `deploy/vps/etl.env.example`.

## 1. Must change (values decided)

| File | Name | Now on UAT | Set to | Why |
|---|---|---|---|---|
| `prod.env` | `PP_UPLOAD_FILES_MB` | `22` | `32` | KP-4. Edge `client_max_body_size` for single-file routes. `INTAKE_MAX_FILE_MB` is now 30 (code default, no env key). The compose default is already 32, but UAT pins 22 explicitly, so the pin must be edited. |
| `prod.env` | `PP_UPLOAD_BIG_MB` | `256` | `336` | KP-4. Edge limit for many-file routes (intake batch 11 x 30 MB + overhead). Same pin issue. Edge must be recreated (deploy.sh step 7 does it). |
| `api.env` | `OCR_ENGINE` | `none` (running container shows `none`) | `tesseract` | KP-3. |
| `api.env` | `OCR_LANG_DIR` | not set | `/opt/tessdata` | Folder baked into the api image (`msa.traineddata`, `eng.traineddata`, SHA-256 pinned in `docker/api/Dockerfile`). Never a URL. |
| `prod.env` | `PP_RELEASE_SHA` | not set | the 40-character release SHA (`git rev-parse HEAD` of the pushed commit) | `migrate:all` / `migrate:delta` refuse to run without a SHA (written to `etl_runs.git_sha`); the migrate image has no `.git`. Commented example in `.env.prod.example`. Not secret. |
| `prod.env` | `PP_JOBS_WORKER_ENABLED` | not set (compose default `true`) | `true` (or leave unset) | Compose forces `JOBS_WORKER_ENABLED=${PP_JOBS_WORKER_ENABLED:-true}` into the api container; the intake and OCR jobs run in that one api instance. The rebuild's `intake-env` check reads it inside the api image and `deploy.sh` / `rebuild-db.sh` refuse any other value. Do NOT put `JOBS_WORKER_ENABLED` in `api.env` (compose overrides it). |
| `api.env` | `AI_PROVIDER` | `mock` | REMOVE the line (unset) | Unset defaults to the `mock` id in `ai.config.ts`; with `OCR_ENGINE=tesseract` the registry (`providers/registry.ts`, `case 'mock'`) then returns `SegmenterProvider` (the real-paper segmenter, T-C4, no network call), not the prototype `MockProvider`. An explicit `AI_PROVIDER=mock` behaves the same today but the check fails on it (FR-ADM-Q07.5: the mock is never named on UAT) and it hides the real decision. Also leave `AI_API_KEY` unset. |
| `prod.env` | `PP_STAGE_EXPECT` | not set | leave unset | Only used by `deploy/vps/migration/slot.sh copy` (stage copy counts, default `archive_cloud:38 staging_cloud:89`). The rebuild loads from a fresh V2 dump through the T-A4 procedure, not through `slot.sh copy`. Set it only if the lead approves a different pair for the slot flow. |

## 2. Names that are new in the code since `e34e0a52d` (optional unless noted)

| File | Name | Default | Recommendation for UAT |
|---|---|---|---|
| `api.env` | `PUPIL_DEFAULT_PASSWORD` | none | SECRET. Needed for teacher "Cipta Pelajar" (`POST /api/guru/students` answers 500 while unset; the api still boots). Min 8, long and random. Not present on UAT today. Platform secret store only. |
| `api.env` | `PUPIL_IMPORT_DEFAULT_PASSWORD` | unset = random password nobody knows | SECRET, optional. Unset means a school admin must use "Tetapkan semula kata laluan" after an import. |
| `api.env` | `THROTTLE_GLOBAL_USER_PER_MINUTE` | `1200` | Keep default (D115). Add only to change. |
| `api.env` | `OCR_BATCH_TIMEOUT_MS` | `900000` (15 min) | Keep default. |
| `api.env` | `OCR_WORKERS`, `OCR_PAGE_TIMEOUT_MS` (90000 now), `OCR_MAX_PAGES`, `OCR_RENDER_DPI` ... | see `ocr.config.ts` | Keep defaults; a slow host (the probe took 24 s to start a worker under load) may need `OCR_WORKERS=1`. |
| `api.env` | `JOBS_WORKER_ENABLED` | code default `false` | UAT already runs `true` (container env); keep. Intake and OCR run in this worker. |
| `etl.env` | `PP_MIGRATE_ROSTER_DEFAULT_HASHES` | present on UAT | Decision KP-7 (open) decides its value. SECRET. |

All other names in UAT `api.env` (`INTAKE_TEACHER_ENABLED=true`, `REGISTRATION_OPEN=true`, `IC_HASH_KEY`, `SESSION_SECRET`, `DATABASE_URL`, `PUBLIC_ORIGINS`, `METRICS_*`, throttle and timeout keys, `MARKETPLACE_PLATFORM_WHATSAPP`, `LOG_LEVEL=info`) are unchanged and still valid. `ALLOW_DEMO_SEED=false`, `BIJAK_POC_QUESTIONS=false`, `MAIL_LOG_RESET_LINKS=false` are forced by compose and checked fail-closed by `deploy.sh`.

`JOBS_WORKER_ENABLED`, `OCR_ENGINE`, `OCR_LANG_DIR`, `AI_PROVIDER` and `AI_API_KEY` are checked by `rebuild-db.sh` step 14 (`intake_env_check`) inside the API image (`compose run --entrypoint sh api`: the tessdata folder and the forced worker flag exist only there; the migrate image has neither). `npm run uat:intake-env` (`scripts/uat-ops/u-op-02-intake-env-check.ts`) stays for manual runs where the API's environment and `/opt/tessdata` are present.

Support contact (`Tetapan > Hubungi Sokongan`: e-mel, WhatsApp, waktu perkhidmatan) is NOT an env value and NOT migrated: V2 stores none of it (no settings row; the only trace is a hard-coded `mailto:` link in its Panduan view, and no phone, WhatsApp or hours exist anywhere in V2). The PO supplies the values and the admin saves them once in `/admin/settings`; until then the rebuild lists `support-contact` as PENDING PO INPUT. Nothing is invented.

## 3. Observed on the host, not part of this change (for the lead)

| Item | Observation | Action |
|---|---|---|
| `PP_RAW_PURGE_BY=2026-11-06` | Overdue. Every nightly backup logs `RAW RETENTION OVERDUE`: PITR base backup `20261027T064728Z`, its WAL, and 3 raw `.cloud` copies (restore points `pre_etl` / `pre_delta` of 27 Oct) are still on the host. | Purge per the cutover plan section 7 (`restore-point.sh raw-check`, `pitr.sh cleanup`) or move the date with the lead's approval. PII retention. Not done here (UAT is read-only in this task). |
| `PP_OFFSITE_KIND=none` | Backups stay on the same disk (`/var/backups/pretasiplus`). | Accepted for UAT; take a copy off the host before the replace-all cutover (T-R4). |
| `VITE_PROTOTYPE_SCOPE=on`, `PP_CSP_MODE=report-only` | Set in `prod.env`. | Confirm they are intended for the new release. |
| `PP_BACKUP_FILES=weekly` | Uploaded files are archived weekly only (last `pp-files-20261108...tar.gz`, 129 KB). | Files change by tiny amounts today; see T-A9. |

## 4. Rollout order

1. Back up env files on the host (`cp -p` into a root-only folder; never into the repo).
2. Edit `prod.env` (`PP_UPLOAD_FILES_MB=32`, `PP_UPLOAD_BIG_MB=336`, `PP_RELEASE_SHA=<sha>`) and `api.env` (`OCR_ENGINE=tesseract`, `OCR_LANG_DIR=/opt/tessdata`, delete the `AI_PROVIDER=mock` line, `PUPIL_DEFAULT_PASSWORD` from the secret store). `PP_JOBS_WORKER_ENABLED` stays unset or `true` in `prod.env`.
3. `deploy/vps/deploy.sh --dry-run` must pass preflight before the real run (it checks the files and the demo-seed guard).
4. After deploy (or in the rebuild's step 14 `intake-env (api image)` line, which must PASS): one scanned PDF through intake (AC-QA-43).

Evidence for the OCR values: `docs/ops/r1-uat-rebuild-prep.md` section 3.
