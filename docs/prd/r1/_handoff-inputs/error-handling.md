# Audit: cross-cutting error handling (PRD R1) and the proposed ERR catalogue

## Merge guide (read first)
1. New PRD section `40-cross-cutting.md` **§X10 "Error handling"** = this file's §2 (global behaviour, 2A-2E), §3 (forms), §9 (ERR catalogue), plus §2A-bis (timeouts/retries). Replace NFR-7 with a pointer to §X10.
2. `40-cross-cutting.md` NFR table: add the numbers from §7 and §2A-bis (login 5/min, 20 failures/min/address, 100/15 min/identifier; intake 10/5/500 per day; global 300/min; server timeouts 120/60/65 s; report cap 20/day; client timeouts 30/60/120 s).
3. `60-api-contract.md` §1.4: replace the status table with §1 and §2A of this file; add the module-code registry (§9 IDs) and the rule "UPPER_SNAKE envelope codes, lower_snake gate codes".
4. `10/20/30` screens: replace inline error strings with "ERR-xx" references; keep only screen-specific texts (e.g. gate list items) and cite their ERR id. Section 8 lists the strings to unify. Section 11 gives V2 empty-state texts per screen.
5. Fix list for 20-guru §X: use the 403/404/500 copy in §2D (PRD copy wins over `ds/copy.ts`); FR-MUR-13-10 "1 s" becomes "debounce 800 ms"; FR-MUR-13-11 reworded per OQ-ERR-2.
6. **Code/contract changes (owner sector in brackets):** D1 BM default messages in `api-error.ts` + mock (API platform); D2 filter maps unmapped 4xx, adds 413/415 codes to `ERROR_CODES` (API platform + contract); D3 401 return URL, banner and draft restore (frontend core/session); D4 FE `ApiError.requestId/details` and 502/503/504 codes (frontend core `src/api`); D5 Bijak submit error split (frontend M28 Bijak); D6 error page copy + maintenance page + chunk-load dialog (frontend shell); D7 autosave wording alignment (M28 + PRD); D8 English reward/validation messages (M15 gamification, contract); global offline banner, retry/timeout policy, double-submit lock, toast rules (frontend core/DS).
7. New API surface (needs Delivery Lead approval, contract owner): optional `expectedUpdatedAt` on draft/paper saves + `409 STALE_VERSION` (questions M04, Set Builder/exam builder); intake codes `INTAKE_BATCH_LIMIT`, `INTAKE_ACTIVE_LIMIT`, `INTAKE_DAILY_PAGE_QUOTA` (intake sector); intake job timeouts 90 s/page, 15 min/batch (intake sector); `GET /api/config/support` 404 fix is already in 60 API-SUP-04.
8. Approval gate: the 48 [PROPOSED] copy rows (listed in §12) go to the user once at G1 (D94); rows with V2/PRD/code copy need none.
9. Test hooks: add AC per ERR id (one Playwright or unit assertion per row; 401 return-URL, 429 countdown, offline banner, double-submit, stale-draft dialog are the five cross-cutting specs).
10. Do not merge sections 0 and 10 (audit commentary); keep §1/§4-§7 tables as the "gap and action" annex of the PRD.

Scope: system-wide rules only. Per-screen messages belong to other audits and must reference the ERR IDs below.
Legend: **PRD status** = COMPLETE / PARTIAL / MISSING in `docs/prd/r1/`. **[PROPOSED]** = no evidence in PRD, code or captures; written to be consistent with the existing code. Evidence paths are relative to the worktree `.claude/worktrees/r1-prd-devplan`. The V2 captures in `.evidence/v2-screens/` were swept in the second pass (§11): they hold few error states, so most copy comes from the PRD and the code.

## 0. Verdict

The PRD has **no error-handling section**. `40-cross-cutting.md` holds a single line, NFR-7 ("Every list and form has defined loading, empty and error states with BM copy. No silent failures."), and NFR-4 (a 429 shows a retry message). `60-api-contract.md` section 1.4 has the envelope and 8 HTTP rows, and section 1.7 has the 404-vs-403 rule (COMPLETE). Everything else (session expiry, offline, retries, double-submit, toast vs inline, error pages, reference ID, form messages, upload/job failure, concurrency, quotas) is either missing or exists only as code or as scattered per-screen strings. The code is a good base: one envelope, one filter, one `ApiError` on each side, module code registries with BM messages, an autosave engine, 403/404 pages, a boot-error panel. The work is to write the contract down, fix 7 concrete defects, and add the missing pieces.

Cloud-agent risk (what they would invent today): the generic 401/403/404/500 message text (the server sends English), what to do on 401, what a 502/503/504 looks like, what a form shows for "required", whether to retry, how a stale edit is reported.

### Defects found in existing code (evidence for the Fix list)
| # | Defect | Evidence |
|---|---|---|
| D1 | Server sends English default messages for 401/403/404/409/422/500 and 413 although the PRD says `message` is BM "shown to the user". Only 429 is replaced on the client, and only in http mode. | `apps/api/src/common/errors/api-error.ts:5-14`, `all-exceptions.filter.ts:51-60`, `src/api/errors.ts:117-139` |
| D2 | A raw 4xx that is not 401/403/404/409/422/429/413 (for example **415**, 405, 408) falls through to the 500 branch: it is answered `500 SERVER_ERROR` and logged with a stack. | `all-exceptions.filter.ts:47-65` (`CODE_BY_STATUS` has no 415) |
| D3 | 401 handling clears the session and does `router.replace('/login')` with **no return URL and no message**; unsaved form data is lost. | `src/stores/session.ts:22-24,333-337` |
| D4 | Frontend `ApiError` has no `requestId` and no `details`; the reference ID can never be shown. Statuses 502/503/504/413/415 all collapse to `SERVER_ERROR` with message `HTTP 502`. | `src/api/errors.ts:33-53,67-91,148-153` |
| D5 | Bijak `submit()` treats **every** failure (403, 409, 422, 500) as "Luar talian ..." and retries every 30 s forever. | `src/modules/m28-bijak-spm/pages/AttemptPage.vue:384-390` |
| D6 | Two 500-page copies conflict: PRD 20 section X "Ralat Pelayan" / "Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar lagi." vs code `error500Title 'Sesuatu tidak kena'` / `'Kami tidak dapat memuatkan halaman ini. Cuba lagi sebentar.'`. Same for 403 (PRD long copy vs `'Halaman ini tidak tersedia untuk peranan anda.'`). | `20-guru-admin-sekolah.md:53`; `src/ds/copy.ts:103-110` |
| D7 | Autosave debounce: PRD says 1 s (FR-MUR-13-10), code uses 800 ms; "gagal simpan" (Bijak) vs "Gagal menyimpan" (intake review) for the same state. | `lib/autosave.ts:71`; `IntakeReviewPage.vue:229`; `AttemptPage.vue:412` |

---

## 1. API error envelope and codes

| # | Item | PRD status | Current code | Proposed spec |
|---|---|---|---|---|
| 1.1 | Envelope shape | COMPLETE | `packages/contract/src/common/error.ts:33-57`; filter `all-exceptions.filter.ts:68-69` adds `requestId` and sets `Retry-After` | Keep `{ error: { code, message, fields?, details?, retryAfter?, requestId } }`. Rule: `requestId` is always present (filter guarantees it). |
| 1.2 | Generic code list | PARTIAL (60 s1.4 lists 7 rows; omits `PASSWORD_CHANGE_REQUIRED`, `CSRF_INVALID` is a footnote; no 415/502/503/504) | `ERROR_CODES` has 8 (`error.ts:8-17`); `PAYLOAD_TOO_LARGE` is used but not in the enum | Add to `ERROR_CODES` + `ERROR_STATUS`: `PAYLOAD_TOO_LARGE` 413, `UNSUPPORTED_MEDIA_TYPE` 415, `BAD_REQUEST` 400 (malformed JSON; keep mapping to 422 for body-parser errors per 60 s1.4), `SERVICE_UNAVAILABLE` 503, `TIMEOUT` 504 (proxy-origin, client-synthesised), `BAD_GATEWAY` 502 (client-synthesised). Server only emits 413/415/503; 502/504 come from the proxy and are synthesised on the client from the status. |
| 1.3 | Module code registry | PARTIAL: PRD names a few (`AMBIGUOUS_USERNAME`, `BIJAK_GENERATE_*`, `QUOTA_FULL`) | Registries live in 8 files: `auth/errors.ts` (10), `practice/schema.ts:51-75` (7), `gamification/rewards.ts:66-` (7), `wallet/schema.ts:26` (1), `spm/shared.ts:26` (1), `intake/files.ts:84` (9), `bijak/papers/schema.ts:273` (3). Gate issue codes are lower-case (`chapter_missing`, `stimulus_group_split`, `paper_empty`, `question_missing`) and are NOT envelope codes | One table in the PRD (section 9 below) listing every code, status and BM text. Rule: **envelope `code` = UPPER_SNAKE; gate/issue codes inside `details.gate[]` / `issues[]` = lower_snake**. A new code is added to the PRD table and the contract in the same PR. |
| 1.4 | HTTP status to UI behaviour | MISSING | none central; each module file maps (`list-load.ts:24`, `load-error.ts:21`, `amaran-format.ts:48`) | Section 2 table (A) below. |
| 1.5 | Code to BM message table | MISSING | Messages in contract constants + FE per-module files (`m01 error-lines.ts`, `m02 school-errors.ts`, `m04 ui-errors.ts` ...) | Section 9 catalogue = the table. |
| 1.6 | BM on the wire | PARTIAL: 60 s1.4 says "BM, shown to the user"; D1 | English defaults, `DEFAULT_ERROR_MESSAGES` | **Fix**: change `DEFAULT_ERROR_MESSAGES` to the BM texts of ERR-AUTH-01, ERR-ACC-01, ERR-ACC-02, ERR-SYS-01, ERR-RATE-01, ERR-CON-01, ERR-REQ-01 and the filter's 413/415 branch. Frontend rule: **never display `error.message` for a code that has an ERR row without the ERR text taking precedence when message is English**; for module codes the server message is BM and is shown as is. The mock keeps its text (mock has its own `DEFAULT_ERROR_MESSAGES`, "identical to the mock" comment in `api-error.ts:4`, so update both and the tests). |
| 1.7 | Unmapped status handling | MISSING; D2 | 4xx without a map becomes 500 | Filter: any `HttpException` 4xx not in the map keeps its status with code `BAD_REQUEST` (400/405/408/410 etc.) or `UNSUPPORTED_MEDIA_TYPE` (415) or `PAYLOAD_TOO_LARGE` (413); never log a stack for 4xx. Only non-HttpException and 5xx are `SERVER_ERROR` with a stack in the log. |
| 1.8 | FE `ApiError` carries `requestId`, `details` | MISSING; D4 | `src/api/errors.ts:55-91` | Add `requestId?: string` and `details?: Record<string, unknown>`; `errorFromResponse` copies them; synthesise codes `BAD_GATEWAY`/`SERVICE_UNAVAILABLE`/`TIMEOUT`/`PAYLOAD_TOO_LARGE`/`UNSUPPORTED_MEDIA_TYPE` in `codeForStatus` (502/503/504/413/415). |

---

## 2. Global UI behaviour

### 2A. Status to behaviour (the mapping the PRD lacks)

| HTTP | Code | UI behaviour (default, a screen may override only where its ERR row says so) |
|---|---|---|
| 400 | `BAD_REQUEST` (server maps body-parser 400 to 422) | Treated as 422 (ERR-REQ-01) with the generic text; developer error, logged. |
| 401 | `UNAUTHORIZED` | ERR-AUTH-01 session flow. Never shown inline on a login form (login 401 is `INVALID_CREDENTIALS`, ERR-AUTH-02). |
| 403 | `FORBIDDEN` | ERR-ACC-01: full-page "Akses Ditolak" for a route; toast for an action on an already-open screen. |
| 403 | `PASSWORD_CHANGE_REQUIRED` | ERR-AUTH-07: redirect to the forced password-change screen. |
| 403 | `CSRF_INVALID` | ERR-AUTH-06: dialog, reload. |
| 404 | `NOT_FOUND` | Route-level record or hidden module: full-page "Halaman Tidak Dijumpai" (ERR-ACC-02). Action on an open screen (record deleted meanwhile): toast ERR-ACC-04. |
| 409 | `CONFLICT` and module codes | ERR-CON-* / module rows; toast or inline per the row. Input kept. |
| 413 | `PAYLOAD_TOO_LARGE` | ERR-REQ-03 (inline at the file field, toast for non-file bodies). |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | ERR-REQ-04 (inline at the file field). |
| 422 | `VALIDATION_ERROR` and module codes | ERR-REQ-01: field errors inline (`fields`), else the screen's message region; first invalid field focused. |
| 429 | `RATE_LIMITED` | ERR-RATE-01: inline banner on the screen/section that failed, with countdown from `retryAfter`; never an empty "Ralat" (NFR-4). |
| 500 | `SERVER_ERROR` | ERR-SYS-01: toast for actions; in-place error panel for a failed load; full-page for a failed route boot. Reference ID shown. |
| 502/504 | synthesised | ERR-SYS-02 / ERR-SYS-04: same as 500, GET auto-retried (2A-bis). |
| 503 | `SERVICE_UNAVAILABLE` | ERR-SYS-03 maintenance page when it comes from a page boot; toast otherwise. Module 503 codes (`GENERATE_LIMIT`) use their own row. |
| 0 | `NETWORK_ERROR` | ERR-NET-01 offline banner + per-action message. |

### 2B. Global behaviours

| # | Item | PRD status | Current code | Proposed spec |
|---|---|---|---|---|
| 2.1 | Session expiry / 401 | MISSING in PRD (FR-M01-14 is in the old M01 doc, not in the PRD) | `session.ts:333-337` clears and `replace('/login')`; `client.ts:317` ignores `/api/auth/*` paths; `http-session.ts:136` clears on boot 401; network failure at boot keeps stored session | See ERR-AUTH-01: redirect to `/login?kembali={path+query URL-encoded}` (same-origin paths only; anything else ignored), banner on the login page "Sesi anda telah tamat. Sila log masuk semula.", after login go to `kembali` if the role may open it, else the role home. **Unsaved work:** forms with edits keep a draft copy in `sessionStorage` key `pp.draft.{routeName}.{recordId|new}` (max 200 KB, deleted on successful save or on logout) and restore it after re-login with the V2 notice "Terdapat kerja yang belum disimpan daripada sesi sebelum ini." (observed on V2 Studio create/edit, `admin__admin_studio_questions_create.txt`, `admin_studio__admin_studio_questions_id_edit.txt`; reuse the same text and the same screen element for every restored draft); a Bijak attempt already has `pp.bijak.local.{attemptId}` (`autosave.ts:26`). Only one redirect per 401 burst (debounce 2 s) and parallel in-flight requests are aborted. |
| 2.2 | 403 vs 404 (FR-X2-2) | COMPLETE (40 FR-X2-2, 60 s1.7). One gap noted by the PRD itself: no API feature guard exists today (`60:91`, API-AUTH-16) | `NotFoundPage.vue`, `ForbiddenPage.vue`, `router/outcome.ts:37-38` | Keep. Add to the PRD that UI never distinguishes "hidden" from "unknown id": same page, same copy, no `Rujukan`. Add AC: anonymous + each role requesting a hidden module URL sees the identical 404 page. |
| 2.3 | Offline / online banners | MISSING (only Bijak attempt has `online` listener, `AttemptPage.vue:249`) | none global | ERR-NET-01/02: global banner component. Triggered by `navigator.onLine === false` OR 2 consecutive `NETWORK_ERROR`s within 10 s. Sticky at top, `role="status"`, does not push layout on mobile (overlay). On recovery: banner turns to "Sambungan dipulihkan." for 3 s, queued retries run, then hides. |
| 2.4 | Timeouts and retries | MISSING | Server: `common/health/server-timeouts.ts` (request/headers/keep-alive, env-driven); client: no timeout; Bijak save retry 5 s, submit retry 30 s (`autosave.ts:72`, `AttemptPage.vue:79`) | See 2A-bis below. |
| 2.5 | Idempotency keys | PARTIAL: practice `clientUuid` (60:1010), Bijak submit idempotent (FR-MUR-13-11, `idempotencyKey` = `{attemptId}-hantar`, `AttemptPage.vue:374`), Kuiz finish idempotent (FR-MUR-13-16) | as left | Keep those. [PROPOSED] No generic `Idempotency-Key` header in 1.0. Every other create (tiket, kelas, set, redeem, import) is protected by the double-submit lock (2.6) plus the server's own uniqueness rule (409 duplicate). Rule for new routes: a POST that moves money/points (redeem, convert tokens) MUST be idempotent per `(userId, clientUuid)`; the PRD AC-CHAIN-9 refund-once rule already requires it. |
| 2.6 | Double-submit protection | PARTIAL: AC-MUR-13-6 only (Hantar twice) | button-level in places | Rule: on the first activation of any submit/save/delete/redeem/publish control, set `disabled` + `aria-busy="true"` + spinner and label "Sedang diproses..." (or the screen's own progressive label, for example "Menyimpan..."); re-enable only when the request settles (success: navigate/reset; error: restore). Enter key and double-click are ignored while busy. Dialog confirm buttons follow the same rule. |
| 2.7 | Optimistic updates and rollback | MISSING | autosave is local-first (`autosave.ts`) | Rule: no optimistic UI except (a) autosave of answers, (b) the "Ditanda" flag, (c) read-state toggles. On failure of (b)/(c) the control reverts and toast ERR-SAVE-04. All other actions wait for the server (spinner), then update. Lists refetch after a mutation; no local cache surgery. |
| 2.8 | Toast vs inline vs page | MISSING | 18 toast uses in 7 files; mixed | Rule table 2C below. |
| 2.9 | Error pages 403/404/500/maintenance | PARTIAL: 403/404/500 copy in 20 s X; D6 conflict; maintenance MISSING | pages exist for 403/404; `GlobalErrorPage.vue`; 500 only in battle games (`permainan-extra.ts:50`); boot panel `app/boot-error.ts` | Full page text in 2D below. |
| 2.10 | Logging and reference ID | PARTIAL: `requestId` in envelope (60 s1.4) | `request-id.ts`, filter logs 5xx stack only (`all-exceptions.filter.ts:62`) | Logging rules and the ID display rule in 2E below. |

### 2A-bis. Timeouts, retries, backoff (all [PROPOSED] unless marked, to be put in the client in one place: `src/api/client.ts`)

| Rule | Value |
|---|---|
| Client request timeout (JSON) | 30 s, then `NETWORK_ERROR` subtype `TIMEOUT` (ERR-NET-02). Abort via `AbortController`; a caller-supplied signal wins. |
| Client timeout, file upload | no total timer; abort when **no progress event for 60 s**. |
| Client timeout, export/blob download | 120 s. |
| Auto-retry | **GET/HEAD only**, on `NETWORK_ERROR`, 502, 503, 504 and 429 (429 only when `retryAfter <= 10`). Max 2 retries, delays 1 s then 3 s, each +-20 % jitter. Attempt counter resets on user action. Never auto-retry 4xx (except 429 above) or 500. |
| Auto-retry of writes | Never, except the two engines that already exist and are idempotent: Bijak answers autosave (debounce 800 ms [existing], retry every 5 s [existing] until success) and Bijak submit (on `online` event and every 30 s [existing], only for NETWORK_ERROR/502/503/504/timeout; any other error stops the loop, see ERR-SAVE-03). |
| Manual retry | Every failed load shows `Cuba Semula` (existing `dsCopy.retry`); it re-issues the same request. |
| Server timeouts (existing, `common/health/server-timeouts.ts:11-13`, `env.schema.ts:225`) | `REQUEST_TIMEOUT_MS` = 120000 (env range 1000-3600000), `HEADERS_TIMEOUT_MS` = 60000 (clamped to the request timeout), `KEEP_ALIVE_TIMEOUT_MS` = 65000, `SHUTDOWN_GRACE_MS` = 25000. State these in the PRD NFR table. Consequence for the client: a JSON call can legitimately run up to 120 s on the server, so the proposed 30 s client timeout applies to normal reads/writes only; **export/blob and import calls use 120 s (+ 5 s margin = 125 s)**, as already proposed for exports. |
| Global API rate limit | existing default 300 requests/min per client (`global-rate-limit.guard.ts:17`), fixed window per process (`throttle/rate-limit.ts:44-47`; note: not shared between instances). |

### 2C. Toast vs inline vs page vs dialog (rule)

| Surface | Use for | Spec |
|---|---|---|
| Inline field error | 422 `fields`, client validation | Under the control, `aria-describedby`, red text, icon, never colour-only. |
| Inline region/banner | failure of a section load, 429, quota, gate list (QE-04 panel), partial import errors | Inside the card/section, with `Cuba Semula` where retry makes sense; `role="alert"` for errors, `role="status"` for info. |
| Toast (error) | failure of an action on an open screen where the screen is still usable (409, 403 on action, 5xx on save, 404 on action) | Top-centre on <768 px, top-right otherwise; error toasts stay **8 s** (hover/focus pauses), 5xx toasts stay until dismissed and show `Rujukan`; success toast 3 s; max 3 stacked, duplicates (same code+message) merged for 5 s; `role="alert"`. |
| Dialog | needs a decision or a login: session expired during a timed attempt, CSRF, stale edit (409 STALE_VERSION), destructive confirm | Focus trap, primary + secondary button, Esc = secondary. |
| Full page | route cannot render: 403, 404, 500 on route load, maintenance, boot failure | Section 2D. |
| Never | `alert()`, silent failure, empty "Ralat" screen, raw English text, stack/JSON | NFR-7 |

### 2D. Error pages (exact text) - one shared `GlobalErrorPage` layout: code chip, title (h1), body, buttons, optional `Rujukan: {requestId}` line (small, copy button "Salin"), 44 px buttons, no horizontal scroll at 375/768/1280.

| Page | Code chip | Title | Body | Buttons | `Rujukan` |
|---|---|---|---|---|---|
| 404 (also hidden module, unknown id, out-of-scope id) | 404 | Halaman Tidak Dijumpai | Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip? | `Halaman Utama` (to role home; `/` if signed out). Pupil only: `Mula Latihan` (to `/practice`). **Open question OQ-ERR-1:** the code shows `Mula Latihan` to every role (`NotFoundPage.vue:23`); staff roles have no Latih Tubi. [PROPOSED] show it for Murid only. | Not shown (would leak existence difference). |
| 403 | 403 | Akses Ditolak | Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir. (PRD 20 s X; replaces code copy `Halaman ini tidak tersedia untuk peranan anda.`) | `Halaman Utama`; `Log Keluar` | Not shown. |
| 500 | 500 | Ralat Pelayan | Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar lagi. (PRD 20; replaces `Sesuatu tidak kena` / `Kami tidak dapat ...`) | `Halaman Utama`; `Cuba Semula` (reload current route) | Shown: `Rujukan: {requestId}` when known, else omitted. |
| Maintenance [PROPOSED] | 503 | Penyelenggaraan Sedang Dijalankan | Sistem sedang diselenggara buat sementara waktu. Sila cuba semula dalam beberapa minit. | `Cuba Semula` | Shown if present. Triggered by a 503 on the session bootstrap `GET /api/session` or on 3 consecutive 502/503/504 GETs; it clears itself after a successful `GET /api/session` (auto-probe every 30 s). |
| Boot failure (exists) | none | Aplikasi gagal dimuatkan | Sila muat semula halaman. Jika masalah berterusan, cuba lagi sebentar nanti. | `Muat semula` | none (app not running). Slow boot after 20 s: "Mengambil masa lebih lama daripada biasa. Sila tunggu atau muat semula halaman." (`app/boot-error.ts:8-15`). Keep. |
| New build available [PROPOSED] | none | (dialog, not page) | Versi baharu tersedia. Sila muat semula halaman. | `Muat Semula` | none. Triggered by a lazy route chunk that fails to load (ERR-SYS-06). |

### 2E. Logging and reference ID
| Rule | Spec |
|---|---|
| Server log | Every error response logs one line: `requestId`, status, `code`, route, userId (if any), role. Level: 5xx `error` (with stack, existing), 401/403/429 `warn`, other 4xx `info`. Message text of user input is never logged; no tokens, passwords or e-mail. |
| ID | `requestId` from the envelope (and the `x-request-id` response header if present). |
| Display | Show `Rujukan: {requestId}` + `Salin` on: 500 page, maintenance page, every 5xx toast/panel, ERR-SYS-* and ERR-EXP/ERR-IMP failures. Not shown for 4xx user errors and never for 404/403 (no existence leak). Ticket link: the `Rujukan` line is followed by "Hubungi sokongan dengan nombor ini." |
| Support | The tiket (support ticket) form prefills nothing from the error; the pupil pastes the ID. No new endpoint is needed. |

---

## 3. Forms

| # | Item | PRD status | Current code | Proposed spec |
|---|---|---|---|---|
| 3.1 | Server validation display | PARTIAL: 60 s1.6 + `fields` in envelope; per-screen messages exist | `readFields` first message per field (`errors.ts:106-115`); 422 `fields` keyed by path | Rule: `fields[path]` shown inline under the control whose `name` matches (dotted path = array index `items.0.text`; nested rows show on the row). Unmatched keys go to a summary banner at the top of the form listing "{message}". A 422 without `fields` shows its `message` in the banner. |
| 3.2 | Client validation | MISSING | zod per form in places | Validate on submit and on blur (after first blur); re-validate on input once a field is in error. Same texts as server (ERR-REQ-10..16) so client/server messages never differ. Client validation never replaces server validation. |
| 3.3 | First-error focus | MISSING | none generic | On a failed submit (client or 422): focus the first invalid control in DOM order, scroll it into view with 16 px margin below the sticky header, and announce "{n} medan perlu dibetulkan." in a `role="alert"` region. |
| 3.4 | Generic field messages | MISSING (exact strings exist only per screen: "Nama diperlukan.", "Sila pilih unit DSKP.", "Pengisytiharan sumber diperlukan.", `fileTooLarge`) | `dsCopy.fileTooLarge`, `required: 'wajib'` | ERR-REQ-10..16 below. |
| 3.5 | Input kept | MISSING | | Rule: any failed submit keeps every typed value, selected file name excluded (re-pick required after 413/415). Password fields are cleared after 401/422 on login only. |

---

## 4. Long-running work

| # | Item | PRD status | Current code | Proposed spec |
|---|---|---|---|---|
| 4.1 | Upload size / type limits | PARTIAL, **conflicting**: paper upload "Maksimum 5 fail, saiz maksimum 20MB setiap fail" (20 s Sumbang Soalan; API-GUR-17 1..5 files 20 MB); user import CSV "maksimum 2 MB" (30 s school/users); question CSV "Saiz maksimum: 5MB. Format: CSV atau TXT" (30:547); API says user import body 1100 kB | JSON body default 100 kB; user import 1100 kB (`all-exceptions.filter.ts:52`); intake: max 10 files/batch, 5 active batches, 500 pages/day, 2 parallel uploads (`intake-files.config.ts:24-27`); `MULTER_LIMITS` per controller | One limits table (ERR-UP table below). Each limit appears once, in the PRD NFR, and is read from the contract constant; error texts take `{n}` and `{jenis}` from the constant, never hard-coded. |
| 4.2 | Upload progress | MISSING | none found | Per file row: name, size, bar with `{n}%`, `Batal`; on done a tick "Selesai"; on fail the ERR text and `Cuba lagi` (re-sends that file only). Multiple files upload with concurrency 2 (matches `INTAKE_UPLOAD_CONCURRENCY` default). Leaving the page during upload asks "Muat naik sedang berjalan. Keluar sekarang?" (`Kekal` / `Keluar`). |
| 4.3 | OCR / import job states | PARTIAL: FR-ADM-Q07.2 ("Sedang diproses" for at most the job timeout, then "Gagal" with reason, `Cuba lagi`; no number); `[PROPOSED] "Pengekstrakan gagal: {sebab}"` | 9 file-level codes `INTAKE_FILE_ERROR_CODES`; today PDF extraction hangs on "Sedang diproses" for ever (30:41) | States: `Menunggu` (queued) -> `Sedang diproses` -> `Selesai` / `Selesai dengan ralat` (partial) / `Gagal` / `Dibatalkan`. Timeouts [PROPOSED]: 90 s per page OCR, 15 min per batch wall-clock, then the batch becomes `Gagal` with `OCR_TIMEOUT`. Polling every 3 s for the first minute, then every 10 s; stop on terminal state. A batch with at least one accepted item and at least one failed page is `Selesai dengan ralat` and lists failed pages with code text (ERR-INT-*). `Cuba lagi` per failed page and for the whole batch; cancelling ends in `Dibatalkan`. |
| 4.4 | Per-row import errors | PARTIAL: response `{imported, errors[{row, message}]}` (API-GUR-19); users import refuses the whole file on `QUOTA_FULL` | | Result panel: "{imported} baris berjaya, {n} baris gagal." then a table `Baris | Medan | Sebab` (max 100 shown, "dan {m} lagi" beyond), plus `Muat Turun Ralat (CSV)`. Valid rows still import (FR-GUR-44-4) except where a rule says the whole file is refused (quota, missing header). |
| 4.5 | Retry | PARTIAL (`Cuba lagi` button exists on batch) | | Retry is always user-initiated for jobs; no silent re-queue. A retry creates a new job attempt on the same file; max 3 retries per file, then "Fail ini gagal diproses berulang kali. Sila hubungi sokongan." |
| 4.6 | Exports (PDF/CSV) | MISSING | `api.blob()` exists (`client.ts:231-243`) | Button shows "Menyediakan..." and is disabled until the download starts; timeout 120 s; failure ERR-EXP-01, empty ERR-EXP-02; file name from `Content-Disposition`. Exports run on the same filters as the screen; the PRD must list which screens export (not in scope of this audit). |
| 4.7 | E-mail / notification failures | MISSING | notifications module exists (`notifications.constants.ts`) | Rule [PROPOSED]: sending is asynchronous and never fails the user action. Failure is logged with `requestId`; the user is not told, except Admin Pusat who sees a status `Gagal dihantar` per message where a send status exists. (No e-mail flow with a user-visible status was found in the PRD sections read; confirm with product.) |

---

## 5. Answering and exams

| # | Item | PRD status | Current code | Proposed spec |
|---|---|---|---|---|
| 5.1 | Autosave interval | PARTIAL: FR-MUR-13-10 "1 s debounce", AC-MUR-13-5 "within 2 s 'disimpan'" | 800 ms debounce, retry 5 s, `sendBeacon` not seen in the file read | Set the PRD to "debounce 800 ms (not above 1 s)" or change code to 1000; recommend aligning the PRD to the code (improve, not rebuild). Status words stay as V2: `menyimpan…`, `disimpan`, `luar talian`, `gagal simpan`, closed text (`AttemptPage.vue:409-413`). |
| 5.2 | Resume after refresh / disconnect | PARTIAL: FR-MUR-13-10 "restores on reload and on another device"; PRD 10:744 has a resume copy with "gagal simpan" | local mirror `pp.bijak.local.{id}`; merge: higher `rev` wins per part (`autosave.ts:183-190`) | Keep. State: if local storage is unavailable (quota/private mode) autosave still goes to the server and the status shows `gagal simpan` only when the server also fails. Resume page copy stays as in PRD 10 B. |
| 5.3 | Timer drift | PARTIAL: "timer is UX only" (10:1343), "a late submit is accepted" (FR-MUR-13-11) vs code `closed` handling | `clockOffset = serverNow - Date.now()` (`AttemptPage.vue:236`), auto-submit at 0 | Keep server-clock offset; the timer re-syncs on every successful save response; at 0 the client auto-submits (`auto: true`). **Conflict to resolve (OQ-ERR-2):** FR-MUR-13-11 says a late submit is accepted, `autosave.ts:36` says the server reports "closed (deadline passed)". Proposed single rule: answers saved before the deadline + a tolerance of 30 s are counted; if the server reports `closed`, show ERR-SAVE-05 and open the result. |
| 5.4 | Submit when offline | PARTIAL (code only) | `AttemptPage.vue:384-390`: message + retry on `online` and every 30 s; D5 | Keep copy "Luar talian. Jawapan anda disimpan pada peranti ini dan akan dihantar apabila sambungan pulih." but **only for** NETWORK_ERROR/timeout/502/503/504; other statuses: 409 `ALREADY_SUBMITTED` -> go to the result silently; 403/404 -> ERR-ACC-01/02 page; 422/500 -> ERR-SAVE-03 with `Cuba Semula`. Show a persistent banner "Belum dihantar" until sent. |
| 5.5 | Duplicate attempt / double submit | PARTIAL: AC-MUR-13-6; contract codes `ALREADY_SUBMITTED` 409, `ALREADY_COMPLETED` 409, `NO_ATTEMPTS_LEFT` 409 | `practice/schema.ts:69-74` | Server: second submit returns the first result (200, same body) for the same key; `ALREADY_SUBMITTED` is only used for a different key. Pupil sees the result screen, never an error. Rows: ERR-PRAC-05..07. |
| 5.6 | Non-Bijak practice (Latih Tubi, Soalan by Chapter, Databank, Kuiz) offline | MISSING | answers sent per question with `clientUuid` (60:1010) | Each answer POST is retried like a GET-style idempotent write: 3 tries, 1 s/3 s/5 s; if still failing the question stays on screen with "Jawapan belum dihantar. Cuba Semula" and the pupil cannot move to the next question until sent or `Langkau` (skip, unanswered). No local queue across reloads in 1.0. |
| 5.7 | Another tab / device opens the same attempt | MISSING | | The later load wins reads; answers merge by `rev` (existing). No lock. No message. |

---

## 6. Concurrency

| # | Item | PRD status | Current code | Proposed spec |
|---|---|---|---|---|
| 6.1 | Two admins edit one question | PARTIAL (the PRD never states it, but the code already versions questions: live version keeps serving, `edit-as-draft` creates version n+1 and answers 409 `CONFLICT` with `details.id`/`details.versionNo` when a draft/review already exists, `questions/paths.ts:224`; reports carry `expectedVersionNo`, `question-workflow/reports.ts:41,300`). A **second admin editing the same draft** is not protected. | no `expectedUpdatedAt` on draft saves found | Live-question case: ERR-CON-02 (existing 409). Same-draft case [PROPOSED-DECIDED]: draft save/status/publish and Set Builder paper saves accept optional `expectedUpdatedAt`; mismatch = `409 STALE_VERSION` (module code on `CONFLICT`), ERR-CON-02b. Last-write-wins is not allowed for question content. Optional field = backward compatible. |
| 6.2 | Stale bulk count | PARTIAL: "stale count = 409" (60:458, 669-674) | `FILTER_ACTION_CAP` | ERR-CON-03 text. |
| 6.3 | Lifecycle pair not allowed | PARTIAL (60 `API-Q-06`) | | ERR-CON-04. |
| 6.4 | Locks | MISSING | none | Decision [PROPOSED]: **no pessimistic locks** in 1.0; optimistic versioning only (6.1). |

---

## 7. Rate limits and quotas

| # | Item | PRD status | Current code | Proposed spec |
|---|---|---|---|---|
| 7.1 | Login attempts | PARTIAL: only "429" in API-AUTH-01 | `auth/login-throttle.service.ts:30-51`, `auth.constants.ts:8` `DEFAULT_LOGIN_LIMIT = 5`: (1) **5 attempts per 60 s per identifier + client address** (env `THROTTLE_LOGIN_PER_MINUTE`, min 1), counted before the password check, so the 6th attempt gets 429 even with the right password; (2) **20 failed logins per 60 s per address** across all identifiers (`IP_FAIL_LIMIT`); (3) **100 failed logins per 15 min per identifier** across all addresses (`LOGIN_IDENTIFIER_FAIL_LIMIT`); `retryAfter` = 1..900 s | Put these three layers and numbers in the PRD NFR table. Message ERR-AUTH-09 (existing text). |
| 7.2 | Generic 429 UX | PARTIAL: NFR-4 + 60 s1.3 | fixed window 60 s per process, global 300/min (`global-rate-limit.guard.ts:17`), FE constant `RATE_LIMITED_MESSAGE_BM 'Terlalu banyak percubaan. Cuba sebentar lagi.'` vs auth `'Terlalu banyak percubaan. Sila cuba sebentar lagi.'` (two near-duplicates) | ERR-RATE-01 single text; countdown "Cuba lagi dalam {s} saat." from `retryAfter`; the retry button is disabled until the countdown ends. |
| 7.3 | Daily cap 20 | **PARTIAL (resolved)**: it is the **pupil/teacher question report** (Laporan Soalan, module 54): "Question report reasons 1-8 per report; daily cap 20 (OQ-API-06)" (60:462); OQ-API-06 decided 20 per day, plan S5-T06 and OQ-MUR-15 aligned (60:1276). Not a paper-generation cap (`GENERATE_LIMIT` is a solver budget) | `packages/contract/src/question-workflow/reports.ts:55` `QUESTION_REPORT_DAILY_CAP = 20` per reporter per Malaysia day; `reports.service.ts:153-158` throws `RATE_LIMITED` 429 with `retryAfter` = seconds to the next 24 h boundary of the counter and message `QUESTION_REPORT_MESSAGES.dailyCap` (`reports.ts:38`) | ERR-QUOTA-02 now = existing code and text (see 9.5). A refresh of an open report is not new and does not count. |
| 7.4 | Subscription seat limit | COMPLETE: "Kuota penuh! Sila tingkatkan kuota dahulu." 409 `QUOTA_FULL`, whole file refused (60:581; 20:1462/1472; 30:1050-1054) | | ERR-QUOTA-01 as is. |
| 7.5 | Intake quotas | PARTIAL (PRD silent) | 10 files/batch, 5 active batches, 500 pages/day, writes 20/min, reads 240/min per user (`intake-files.config.ts:24-35`) | ERR-QUOTA-03..05 texts. |
| 7.6 | `Retry-After` use | PARTIAL | header set by the filter (`:68`); FE reads it (`errors.ts:99-104`) | UI must prefer `retryAfter` from the body, then the header, else 30 s. |

---

## 8. Consistency of existing messages (10 / 20 / 30 and code)

Messages that mean the same thing but are worded differently, to be unified to the ERR text on the right.

| Concept | Variants seen (source) | Unify to |
|---|---|---|
| Generic load failure | `Tidak dapat memuatkan data. Sila cuba semula.` (`ds/copy.ts:18`); `Gagal memuat senarai.` + `Cuba lagi` (30:980); `Percubaan tidak dapat dimuatkan.` (AttemptPage:241); `Ralat semasa mencari bank soalan.` (30:605); `Maaf, terdapat masalah memuatkan kuiz ulang kaji.` (practice) | ERR-SYS-01b "Tidak dapat memuatkan data. Sila cuba semula." (keep the `dsCopy.loadError` text) with `Cuba Semula`; keep the practice text only for `NO_WRONG_QUESTIONS` |
| Retry button | `Cuba Semula` (dsCopy, 500 page), `Cuba lagi` (30:980, 674; 1286), `Cuba Lagi` (dsCopy.wheelReset) | `Cuba Semula` for retry of a failed request; `Cuba Lagi` only for game/quiz replay (wheelReset) and "Cuba Lagi" paper attempt (FR-MUR-13-15) |
| Rate limited | `Terlalu banyak percubaan. Cuba sebentar lagi.` (FE) / `... Sila cuba sebentar lagi.` (contract) / `Too Many Attempts.` (server default) | ERR-RATE-01 |
| Save failed | `gagal simpan` (Bijak) / `Gagal menyimpan` (intake review) / `Susunan gagal disimpan - muat semula halaman dan cuba lagi.` / `Soalan gagal ditambah - cuba lagi.` / `Soalan gagal dibuang - cuba lagi.` / `Bahagian gagal dikemas kini.` (30:605) / `Gagal menghantar laporan. Sila cuba lagi.` (10:920,929) | ERR-SAVE-01 inline status `Gagal menyimpan` (keep `gagal simpan` only in the Bijak lower-case status line, V2 verbatim); action toasts: `{Tindakan} gagal. Cuba lagi.` pattern ERR-SAVE-02 |
| Publish errors | `Ralat tidak dijangka semasa menerbitkan.` / `Ralat rangkaian semasa menerbitkan.` (30:605) | ERR-NET-01 + ERR-SYS-01 with the verb "menerbitkan" in the action pattern; keep as V2 copy for the Set Builder only (listed fidelity exception) |
| Offline | `Luar talian` / `Luar talian. Cuba lagi.` (KuizPage:59) / `Luar talian. Semak sambungan anda.` (builder api:149) / `luar talian` (status) / long submit text | ERR-NET-01 `Anda sedang luar talian. Semak sambungan internet anda.`; status word `luar talian` stays in the autosave status line |
| Not found | `Rekod tidak dijumpai.` (practice) / `Kertas tidak ditemui` (bijak; "ditemui" vs "dijumpai") / `Konfigurasi sokongan tidak dijumpai.` (defect) / `Not Found.` / `Halaman Tidak Dijumpai` | Record in an action: `Rekod tidak dijumpai.`; Bijak `Kertas tidak ditemui` -> `Kertas tidak dijumpai.`; always "dijumpai" |
| Access denied | `Akses Ditolak` (page) / `This action is unauthorized.` / `Peranan ini tidak tersedia untuk akaun anda.` | ERR-ACC-01 |
| Invalid | `Nilai tidak sah.` / `Jawapan tidak sah.` / `Mod tidak sah.` / `Sesi tidak sah. ...` / `The given data was invalid.` | ERR-REQ-01 default; the specific ones stay for their field |
| Not enough questions | `Soalan tidak mencukupi.` (2 codes) / `Kertas tidak dapat dijana kerana soalan tidak mencukupi.` / `{n} soalan lagi diperlukan.` | keep (different contexts) |
| Missing field (select) | `Sila pilih unit DSKP.` / `Sila pilih Bab.` / `Sila pilih tahap kesukaran.` | pattern `Sila pilih {medan}.` (ERR-REQ-11) |
| Missing field (text) | `Nama diperlukan.` / `Pengisytiharan sumber diperlukan.` / `Status hak cipta diperlukan.` | pattern `{Medan} diperlukan.` (ERR-REQ-10) |
| Empty states | `Belum ada {item}.`, `Tiada {item} dijumpai.`, `Tiada data dijumpai.`, `Tiada data untuk tempoh ini.`, `Tiada data.`, `Tiada data untuk dipaparkan.`, `Belum ada data`, `Tiada laporan lagi` (`ds/copy.ts:37-42,118`; 40 AC-X2-3) | Already a pattern set in `dsCopy`; add rule: `Belum ada` = user has never created/received any; `Tiada ... dijumpai` = a filter/search returned nothing; `Tiada data untuk tempoh ini.` = a period filter. Each empty state offers the next action (FR-X2-0). |
| Mixed EN/BM | server defaults (D1); `Payload Too Large.`; `HTTP 502`; `Network request failed` (`client.ts:305`); `Mastered`/`Developing` (kept as V2, 30:1258); English weekday abbreviations on Engagement bars (kept as V2) | BM for all error text; the two V2-kept English labels stay as listed fidelity exceptions. |
| 403/500 page copy | PRD 20 vs `dsCopy` (D6) | PRD 20 copy |

---

## 9. Proposed catalogue ERR-xx (merge into the PRD as section "X10 Error handling")

Display tokens. **Show**: I = inline field, R = inline region/banner, T = toast, D = dialog, P = full page. **Kept**: Y = typed input kept; N = nothing to keep. **Log**: E = error + stack, W = warn, I = info (no log of user input). **Ref**: Y = show `Rujukan: {requestId}`; N = never; the 5xx rows are always Y.
Existing = text already in code/contract (quoted exactly). All other text is [PROPOSED].

### 9.1 Connectivity and server (client-synthesised or proxy)
| ID | Code | HTTP | When | BM message | Show | Action offered | Kept | Log | Ref |
|---|---|---|---|---|---|---|---|---|---|
| ERR-NET-01 | NETWORK_ERROR | 0 | no response / `navigator.onLine` false | Anda sedang luar talian. Semak sambungan internet anda. (banner) ; per action: Tindakan tidak dapat dihantar. Semak sambungan anda. | B (banner) + T | `Cuba Semula` | Y | I (client) | N |
| ERR-NET-02 | TIMEOUT | 0/504 | no reply within 30 s (JSON) / 60 s no upload progress / 120 s export | Permintaan mengambil masa terlalu lama. Cuba lagi. | T (action) / R (load) | `Cuba Semula` | Y | W | Y |
| ERR-NET-03 | (recovery) | - | connection back | Sambungan dipulihkan. | banner 3 s | none | - | - | N |
| ERR-SYS-01 | SERVER_ERROR | 500 | unhandled server exception | Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar lagi. | action: T (stays until closed); load: R; route: P (500 page) | `Cuba Semula` ; page also `Halaman Utama` | Y | E | Y |
| ERR-SYS-01b | SERVER_ERROR | 500/502/504 | a GET list/card fails after auto-retry | Tidak dapat memuatkan data. Sila cuba semula. (existing `dsCopy.loadError`). **V2 observed (admin list screens: users, import, Kirkpatrick; in PRD 30:980 with `Cuba lagi`): "Gagal memuat senarai."** Use V2 text for admin/staff **list** screens, `dsCopy.loadError` for every other section. | R in the section | `Cuba Semula` (V2 admin lists keep the V2 label `Cuba lagi`) | N | E/W | Y |
| ERR-SYS-02 | BAD_GATEWAY | 502 | proxy upstream down | same as ERR-SYS-01 | as 01 | as 01 (GET auto-retry 2x) | Y | W | Y |
| ERR-SYS-03 | SERVICE_UNAVAILABLE | 503 | maintenance / overload on boot | Sistem sedang diselenggara buat sementara waktu. Sila cuba semula dalam beberapa minit. | P (maintenance page) at boot; T otherwise | `Cuba Semula` | Y | W | Y |
| ERR-SYS-04 | TIMEOUT | 504 | proxy timeout | same as ERR-NET-02 | as NET-02 | `Cuba Semula` | Y | W | Y |
| ERR-SYS-05 | (boot) | - | app/bundle fails to start | Aplikasi gagal dimuatkan / Sila muat semula halaman. Jika masalah berterusan, cuba lagi sebentar nanti. (existing) | P | `Muat semula` | N | client console | N |
| ERR-SYS-06 | (chunk) | - | lazy route chunk 404 after a deploy | Versi baharu tersedia. Sila muat semula halaman. | D | `Muat Semula` | warn: unsaved draft saved to sessionStorage first | I | N |
| ERR-SYS-07 | OVERLOAD (db pool/tx timeout) | 429 | `isOverloadError` (`auth.errors.ts:25`) | Sistem sedang sibuk. Sila cuba sebentar lagi. | R | countdown + `Cuba Semula` | Y | W | Y |

### 9.2 Authentication and session
| ID | Code | HTTP | When | BM message | Show | Action | Kept | Log | Ref |
|---|---|---|---|---|---|---|---|---|---|
| ERR-AUTH-01 | UNAUTHORIZED | 401 | session missing/expired on a non-auth route | Sesi anda telah tamat. Sila log masuk semula. | redirect to `/login?kembali=` + banner R on login page; during a timed Bijak attempt: D (no redirect until the pupil confirms) "Sesi anda telah tamat. Jawapan anda disimpan pada peranti ini. Log masuk semula untuk meneruskan." | `Log Masuk Semula` | Y (draft in sessionStorage) | W | N |
| ERR-AUTH-02 | INVALID_CREDENTIALS | 401 | wrong identifier or password | E-mel/Nama pengguna atau kata laluan tidak sah. (existing) | R above form | none (re-type) | identifier kept, password cleared | W | N |
| ERR-AUTH-03 | ACCOUNT_INACTIVE | 403 | inactive/suspended account | Akaun anda tidak aktif atau telah digantung. Sila hubungi pentadbir. (existing) | R | none | identifier kept | W | N |
| ERR-AUTH-04 | SCHOOL_INACTIVE | 403 | school not activated | Sekolah anda belum diaktifkan oleh pentadbir. Sila hubungi pihak sekolah. (existing) | R | none | Y | W | N |
| ERR-AUTH-05 | AMBIGUOUS_USERNAME | 422 | username exists in several schools | Nama pengguna ini wujud di lebih daripada satu sekolah. Sila pilih sekolah anda. (existing) | R + school picker from `details.schools` | `Pilih Sekolah` | Y | I | N |
| ERR-AUTH-06 | CSRF_INVALID | 403 | CSRF header missing/wrong | Sesi tidak sah. Sila muat semula halaman dan cuba lagi. (existing) | D | `Muat Semula` | draft saved first | W | Y |
| ERR-AUTH-07 | PASSWORD_CHANGE_REQUIRED | 403 | `mustChangePassword` | Sila tukar kata laluan anda sebelum meneruskan. (existing) | P (redirect to change-password screen) | `Tukar Kata Laluan` | N | I | N |
| ERR-AUTH-08 | ROLE_NOT_ALLOWED / MODE_ACTIVE / MODE_ALREADY_ACTIVE / MODE_NOT_ALLOWED / NO_MODE_ACTIVE | 403/409 | role switch / Mod Pelajar misuse | exactly the five existing texts in `AUTH_ERROR_MESSAGES` (`auth/errors.ts:51-55`) | T | none | N | I | N |
| ERR-AUTH-09 | RATE_LIMITED | 429 | login throttle: 6th attempt within 60 s for the same identifier+address; or 20 failed logins/min from one address; or 100 failed logins/15 min for one identifier; `retryAfter` 1..900 s | Terlalu banyak percubaan. Sila cuba sebentar lagi. (existing) + "Cuba lagi dalam {s} saat." (use minutes when s >= 120: "{m} minit") | R above form | submit disabled until countdown ends | identifier kept | W | N |

### 9.3 Access
| ID | Code | HTTP | When | BM message | Show | Action | Kept | Log | Ref |
|---|---|---|---|---|---|---|---|---|---|
| ERR-ACC-01 | FORBIDDEN | 403 | role not allowed (feature on) | Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir. (route) ; action on open screen: Anda tidak dibenarkan melakukan tindakan ini. | route: P; action: T | `Halaman Utama` / none | Y | W | N |
| ERR-ACC-02 | NOT_FOUND | 404 | unknown id, out-of-scope id, hidden module | page copy 2D | P | `Halaman Utama` | N | I | N |
| ERR-ACC-03 | NOT_FOUND | 404 | hidden module by URL (FR-X2-2) | identical to ERR-ACC-02 (no distinct page) | P | as 02 | N | I | N |
| ERR-ACC-04 | NOT_FOUND | 404 | action on a record deleted meanwhile | Rekod tidak dijumpai. Ia mungkin telah dipadam. | T | `Muat Semula` | Y | I | N |

### 9.4 Request, validation, files
| ID | Code | HTTP | When | BM message | Show | Action | Kept | Log | Ref |
|---|---|---|---|---|---|---|---|---|---|
| ERR-REQ-01 | VALIDATION_ERROR | 422 | body/query invalid | field texts from `fields`; banner: `{n} medan perlu dibetulkan.`; no fields: Data yang dihantar tidak sah. Sila semak dan cuba lagi. | I + R | focus first invalid field | Y | I | N |
| ERR-REQ-02 | BAD_REQUEST (mapped to 422) | 400->422 | malformed JSON | Permintaan tidak sah. Sila muat semula halaman dan cuba lagi. | T | `Muat Semula` | Y | W | Y |
| ERR-REQ-03 | PAYLOAD_TOO_LARGE | 413 | body/file over limit | Fail atau data terlalu besar. Saiz maksimum ialah {n} MB. | I at file field / T | `Pilih Fail Lain` | other fields Y, file N | I | N |
| ERR-REQ-04 | UNSUPPORTED_MEDIA_TYPE | 415 | wrong file type | Jenis fail tidak disokong. Format dibenarkan: {senarai}. | I at file field | `Pilih Fail Lain` | other fields Y, file N | I | N |
| ERR-REQ-05 | (client) | - | file > limit before upload | Fail melebihi saiz maksimum {n} MB. (existing `dsCopy.fileTooLarge`) | I | pick another | N | none | N |
| ERR-REQ-06 | (client) | - | too many files | Maksimum {n} fail dibenarkan. | I | remove files | Y | none | N |
| ERR-REQ-07 | (client) | - | empty file / nothing chosen | Sila pilih fail. | I | pick | N | none | N |
| ERR-REQ-10 | (text required) | 422 | empty required text | {Medan} diperlukan. (existing pattern "Nama diperlukan.") | I | - | Y | - | N |
| ERR-REQ-11 | (select required) | 422 | empty required choice | Sila pilih {medan}. (existing "Sila pilih Bab.") | I | - | Y | - | N |
| ERR-REQ-12 | (too long) | 422 | over max length | {Medan} tidak boleh melebihi {n} aksara. | I | - | Y | - | N |
| ERR-REQ-13 | (too short) | 422 | under min | {Medan} mesti sekurang-kurangnya {n} aksara. (password: Kata laluan mesti sekurang-kurangnya 8 aksara.) | I | - | Y | - | N |
| ERR-REQ-14 | (format) | 422 | pattern fail | Format {medan} tidak sah. (e-mel: Format e-mel tidak sah.) | I | - | Y | - | N |
| ERR-REQ-15 | (range) | 422 | number out of range | Nilai mesti antara {min} dan {max}. | I | - | Y | - | N |
| ERR-REQ-16 | (duplicate) | 409 | unique value exists | {Medan} ini sudah digunakan. | I | - | Y | - | N |

### 9.5 Rate and quota
| ID | Code | HTTP | When | BM message | Show | Action | Kept | Log | Ref |
|---|---|---|---|---|---|---|---|---|---|
| ERR-RATE-01 | RATE_LIMITED | 429 | any throttle | Terlalu banyak percubaan. Sila cuba sebentar lagi. + "Cuba lagi dalam {s} saat." | R in the failed section | `Cuba Semula` enabled after countdown; GET auto-retry once when retryAfter <= 10 | Y | W | N |
| ERR-QUOTA-01 | QUOTA_FULL | 409 | import rows > remaining seats | Kuota penuh! Sila tingkatkan kuota dahulu. (existing) | R | none; whole file refused | file N | I | N |
| ERR-QUOTA-02 | RATE_LIMITED (existing; no new code) | 429 | 21st new question report by one reporter in a Malaysia day (`QUESTION_REPORT_DAILY_CAP` = 20) | Anda telah mencapai had 20 laporan sehari. Sila cuba lagi esok. (existing, `question-workflow/reports.ts:38`) ; `retryAfter` = seconds until the cap window ends | R inside the report dialog | none (dialog stays; submit disabled) | comment Y | W | N |
| ERR-QUOTA-03 | INTAKE_BATCH_LIMIT [PROPOSED code+copy; limit exists: `INTAKE_MAX_FILES_PER_BATCH` default 10] | 422 | more than 10 files in a batch (also the Sumbang Soalan paper upload: 1..5 files, V2 copy "Maksimum 5 fail, saiz maksimum 20MB setiap fail") | admin intake: Maksimum 10 fail setiap kumpulan. ; teacher paper upload: Maksimum 5 fail, saiz maksimum 20MB setiap fail (V2) | I | remove files | Y | I | N |
| ERR-QUOTA-04 | INTAKE_ACTIVE_LIMIT [PROPOSED code+copy; limit exists: `INTAKE_MAX_ACTIVE_BATCHES` default 5] | 409 | more than 5 active batches | Terlalu banyak kumpulan sedang diproses (maksimum 5). Tunggu salah satu selesai. | R | `Lihat Kumpulan` | Y | I | N |
| ERR-QUOTA-05 | INTAKE_DAILY_PAGE_QUOTA [PROPOSED code+copy; limit exists: `INTAKE_DAILY_PAGE_QUOTA` default 500] | 429 | more than 500 pages/day | Kuota halaman harian (500) telah dicapai. Cuba lagi esok. | R | none | Y | I | N |
| ERR-QUOTA-06 | RATE_LIMITED | 429 | intake writes over 20/min/user or reads over 240/min/user (`INTAKE_LIMITS`, 60 s window); upload concurrency 2 (`INTAKE_UPLOAD_CONCURRENCY`) | same text as ERR-RATE-01 | R | countdown | Y | W | N |
| ERR-QUOTA-07 | RATE_LIMITED | 429 | global API ceiling 300 requests/min/client (`global-rate-limit.guard.ts:17`) | same text as ERR-RATE-01 | R | countdown | Y | W | N |

### 9.6 Conflict and concurrency
| ID | Code | HTTP | When | BM message | Show | Action | Kept | Log | Ref |
|---|---|---|---|---|---|---|---|---|---|
| ERR-CON-01 | CONFLICT | 409 | generic conflict | Tindakan ini bercanggah dengan keadaan semasa. Muat semula dan cuba lagi. | T | `Muat Semula` | Y | I | N |
| ERR-CON-02 | CONFLICT (existing) + `details.id`, `details.versionNo` | 409 | admin presses edit on a live question while a newer draft/review version already exists (`POST /questions/:id/edit-as-draft`, `questions/paths.ts:224`) | Soalan ini sudah mempunyai draf yang sedang disunting (versi {versionNo}). Buka draf itu. [PROPOSED copy; the behaviour and 409 exist] | D | `Buka Draf` (to `details.id`) / `Kembali` | Y | I | N |
| ERR-CON-02b | STALE_VERSION [PROPOSED-DECIDED] | 409 | two admins save the **same draft**: PUT carries `expectedUpdatedAt` of the draft version, differs | Draf ini telah dikemas kini oleh pengguna lain. Muat semula untuk melihat versi terkini. (paper: Kertas ini telah dikemas kini oleh pengguna lain. ...) | D | `Muat Semula Versi Terkini` (copies the user's edits to `pp.draft.*` first and offers `Pulihkan Suntingan Saya`) / `Kembali` | Y | I | N |
| ERR-CON-03 | CONFLICT | 409 | bulk-by-filter count changed | Bilangan soalan telah berubah ({lama} kepada {baru}). Semak semula sebelum meneruskan. | D | `Semak Semula` | filter Y | I | N |
| ERR-CON-04 | CONFLICT | 409 | lifecycle pair not allowed | Perubahan status ini tidak dibenarkan daripada status semasa. | T | none | Y | I | N |
| ERR-CON-05 | CONFLICT | 409 | member already in another group / pending item blocks (60:621,657) | server message (BM) shown as is | T | none | Y | I | N |

### 9.7 Practice, wallet, rewards, Bijak, SPM (all existing text, quoted exactly)
| ID | Code | HTTP | BM message | Show | Action |
|---|---|---|---|---|---|
| ERR-PRAC-01 | TRIAL_EXHAUSTED | 402 | Baki percubaan percuma anda telah habis. | R | none |
| ERR-PRAC-02 | NOT_ENOUGH_QUESTIONS / SET_NOT_READY | 422 | Soalan tidak mencukupi. | R | `Kembali` |
| ERR-PRAC-03 | NO_WRONG_QUESTIONS | 422 | Maaf, terdapat masalah memuatkan kuiz ulang kaji. | R | `Kembali` |
| ERR-PRAC-04 | ALREADY_COMPLETED | 409 | Misi ini sudah diselesaikan. / Ujian ini sudah selesai. | R | `Kembali` |
| ERR-PRAC-05 | NO_ATTEMPTS_LEFT | 409 | Tiada percubaan lagi untuk set ini. | R | `Kembali` |
| ERR-PRAC-06 | ALREADY_SUBMITTED | 409 | Sesi ini sudah dihantar. | pupil is sent to the result (no error shown when the same key) | `Lihat Keputusan` |
| ERR-PRAC-07 | (generic) | 422 | Rekod tidak dijumpai. / Nilai tidak sah. / Jawapan tidak sah. / Mod tidak sah. (`PRACTICE_MESSAGES`) | T | none |
| ERR-WAL-01 | INSUFFICIENT_BALANCE | 409 | Baki syiling tidak mencukupi. / Baki token tidak mencukupi. | T | `Kembali` |
| ERR-RWD-01 | OUT_OF_STOCK | 409 | Stok hadiah telah habis. | T | `Kembali` |
| ERR-RWD-02 | MONTHLY_CAP | 409 | Had tebusan bulanan dicapai. | T | `Kembali` |
| ERR-RWD-03 | INSUFFICIENT_TOKENS | 409 | Token tidak mencukupi. (near-duplicate of ERR-WAL-01 "Baki token tidak mencukupi."; keep both, they are existing live-aligned copy) | T | `Kembali` |
| ERR-RWD-04 | DRAW_CLOSED | 409 | Cabutan ditutup. | T | `Kembali` |
| ERR-RWD-05 | TICKET_LIMIT | 409 | Had tiket dicapai. | T | `Kembali` |
| ERR-RWD-06 | INSUFFICIENT_BALANCE | 409 | Baki syiling tidak mencukupi. | T | `Kembali` |
| ERR-RWD-07 | CONFLICT | 409 | Tebusan ini tidak lagi menunggu pemprosesan. (admin process) / Tebusan ini tidak lagi menunggu kelulusan. (parent consent) | T | `Muat Semula` |
| ERR-RWD-08 | NOT_FOUND | 404 | Hadiah tidak dijumpai. / Tebusan tidak dijumpai. / Kotak tidak dijumpai. (existing `REWARD_MESSAGES`); **defect D8:** `REWARD_MESSAGES.notFound` = `Not Found.` and `REWARD_VALIDATION_MESSAGES` are English Laravel text ("The reward id field is required.", "The selected action is invalid.", "The ids field must contain positive integers.") and must become `Rekod tidak dijumpai.` / ERR-REQ-10..14 texts | T | none |
| ERR-BIJ-01 | NO_BLUEPRINT | 422 | Belum ada kontrak untuk subjek dan kertas ini | R | `Kembali` |
| ERR-BIJ-02 | SHORTAGE | 422 | Kertas tidak dapat dijana kerana soalan tidak mencukupi. (+ shortage list) | R | `Kembali` |
| ERR-BIJ-03 | GENERATE_LIMIT | 503 | Kertas tidak dapat disusun sekarang. Cuba lagi. | R | `Cuba Semula` |
| ERR-BIJ-04 | (paper updating) | 409 | Kertas ini sedang dikemas kini dan tidak boleh dicuba buat masa ini. (FR-MUR-13-15) | T | `Kembali` |
| ERR-BIJ-05 | (paper not found) | 404 | Kertas tidak dijumpai. (replaces `Kertas tidak ditemui`) | P | `Halaman Utama` |
| ERR-BIJ-06 | NOT_SUBMITTED | 409 | Bijak scheme/self-mark before Hantar: Skema hanya didedahkan selepas Hantar (`BIJAK_ATTEMPTS_MESSAGES.schemeAfterSubmit`, also used with 403 at `attempts.service.ts:690`); SPM mock: Mock belum dihantar. (`SPM_MESSAGES.mockNotSubmitted`, `spm/shared.ts:18`) | R | `Kembali` |
(Kept/Log/Ref for 9.7: input kept Y, log I, Ref N.)

### 9.8 Questions and intake (gate and job)
| ID | Code | HTTP | When | BM message | Show | Action |
|---|---|---|---|---|---|---|
| ERR-QST-01 | VALIDATION_ERROR + `details.gate[]` | 422 | publish gate fails (QE-04) | panel listing each issue; texts: Sila pilih unit DSKP. / Sila pilih sekurang-kurangnya satu SP DSKP. / Sila pilih Bab. [issue `chapter_missing`] / Sila pilih tahap kesukaran. / Sila pilih kertas untuk soalan SPM. / Bahagian (b) belum ada aras pemikiran. | R panel with links to the step | click link |
| ERR-QST-02 | VALIDATION_ERROR (`stimulus_group_split`) | 422 | a set/paper/placement would split a stimulus group | Soalan dalam kumpulan rangsangan mesti dipilih bersama. (existing 60:526) | I at `questionIds` | add the sibling |
| ERR-QST-03 | VALIDATION_ERROR | 422 | publish a paper with an empty question | “{title}” tiada kandungan - tidak boleh diterbitkan. (60:718, already [PROPOSED]) | R | fix content |
| ERR-QST-04 | VALIDATION_ERROR | 422 | missing declarations | Pengisytiharan sumber diperlukan. / Status hak cipta diperlukan. | I | - |
| ERR-INT-01 | ENCRYPTED | job | password-protected file | Fail dilindungi kata laluan. Buang perlindungan dan muat naik semula. | R in batch row | `Muat Naik Semula` |
| ERR-INT-02 | CORRUPT | job | unreadable file | Fail rosak atau tidak dapat dibaca. | R | `Muat Naik Semula` |
| ERR-INT-03 | TOO_MANY_PAGES | job | over page limit | Fail mempunyai terlalu banyak halaman (maksimum {n}). Bahagikan fail dan muat naik semula. | R | `Muat Naik Semula` |
| ERR-INT-04 | TOO_COMPLEX | job | memory/time while reading | Fail terlalu kompleks untuk diproses. Cuba fail yang lebih ringkas. | R | `Muat Naik Semula` |
| ERR-INT-05 | OCR_TIMEOUT | job | page > 90 s or batch > 15 min | Pengecaman teks mengambil masa terlalu lama. | R | `Cuba lagi` |
| ERR-INT-06 | OCR_FAILED | job | OCR error | Pengecaman teks gagal. | R | `Cuba lagi` |
| ERR-INT-07 | OCR_UNAVAILABLE | job | scanned page, no OCR engine | Halaman imbasan tidak dapat dibaca kerana pengecaman teks tidak tersedia. Taip soalan secara manual. | R | `Tulis Soalan Manual` (same fields, 30:1286) |
| ERR-INT-08 | RENDER_FAILED | job | page image fails | Halaman tidak dapat dipaparkan. | R | `Cuba lagi` |
| ERR-INT-09 | CANCELLED | job | cancelled | Dibatalkan. | status chip | `Cuba lagi` |
| ERR-INT-10 | (batch failed) | job | batch ends Gagal | Pengekstrakan gagal: {sebab}. ([PROPOSED] in 30 FR-ADM-Q07.2; {sebab} = ERR-INT-01..08 text) | R | `Cuba lagi` |
| ERR-INT-11 | (retry exhausted) | 409 | 3 retries used | Fail ini gagal diproses berulang kali. Sila hubungi sokongan. | R | none |
| ERR-INT-12 | (guru paper upload) | 503 today | `UnavailablePaperIntake` (60:195) | Fix the route; no user text should exist for it. Until fixed it falls under ERR-SYS-01. | | |
(Kept: Y; Log: W; Ref: Y for ERR-INT-04,05,06,08,10,11.)

### 9.9 Save, autosave, export, notification
| ID | Code | When | BM message | Show | Action | Kept | Log | Ref |
|---|---|---|---|---|---|---|---|---|
| ERR-SAVE-01 | (autosave status) | save in flight / ok / offline / error | menyimpan… / disimpan / luar talian / gagal simpan (Bijak V2 words); other editors: Menyimpan... / Disimpan / Luar talian / Gagal menyimpan | status line next to the editor | auto-retry every 5 s | Y (local) | I | N |
| ERR-SAVE-02 | (action failed) | save/add/remove/publish fails with 5xx/network | {Tindakan} gagal. Cuba lagi. e.g. Soalan gagal ditambah. Cuba lagi. | T | `Cuba Semula` | Y | E | Y |
| ERR-SAVE-03 | (submit non-network error) | Bijak Hantar returns 422/500 | Jawapan tidak dapat dihantar. Jawapan anda masih disimpan pada peranti ini. | R + D | `Cuba Semula` | Y | E | Y |
| ERR-SAVE-04 | (rollback) | optimistic toggle fails | Perubahan tidak dapat disimpan. Cuba lagi. | T | none | revert | I | N |
| ERR-SAVE-05 | (attempt closed) | server reports deadline passed | Masa tamat. Jawapan yang disimpan sebelum masa tamat telah dihantar. (existing `AttemptPage.vue:413`) | D then result | `Lihat Keputusan` | - | I | N |
| ERR-SAVE-06 | (unsent answer, practice) | answer POST failed 3x | Jawapan belum dihantar. Cuba Semula. | R | `Cuba Semula` / `Langkau` | Y | W | N |
| ERR-SAVE-07 | (check) | Bijak "Semak" fails | Semakan tidak dapat dibuat sekarang. Cuba lagi. (existing `AttemptPage.vue:348`) | R | `Cuba Semula` | Y | I | N |
| ERR-EXP-01 | (export failed) | PDF/CSV fails | Muat turun gagal. Cuba lagi. | T | `Cuba Semula` | Y | E | Y |
| ERR-EXP-02 | (export empty) | no rows | Tiada data untuk dieksport. | T | none | - | - | N |
| ERR-IMP-01 | (import row errors) | CSV rows invalid | {imported} baris berjaya, {n} baris gagal. | R + table | `Muat Turun Ralat (CSV)` | file N | I | N |
| ERR-IMP-02 | (header missing) | 422 | Lajur wajib tiada: {lajur}. Gunakan templat yang disediakan. | I | `Muat Turun Templat` | N | I | N |
| ERR-NOT-01 | (notification send failure) | async send fails | no user text; logged | - | - | - | E | N |

---

## 10. Summary

### Counts
| Section | Items | COMPLETE | PARTIAL | MISSING |
|---|---|---|---|---|
| 1 Envelope and codes | 8 | 1 | 3 | 4 |
| 2 Global UI | 10 | 1 | 4 | 5 |
| 3 Forms | 5 | 0 | 2 | 3 |
| 4 Long-running work | 7 | 0 | 4 | 3 |
| 5 Answering / exams | 7 | 0 | 6 | 1 |
| 6 Concurrency | 4 | 0 | 3 | 1 |
| 7 Rate / quota | 6 | 1 | 5 | 0 |
| **Total (final, after §11/§12)** | **47** | **3** | **27** | **17** |

Section 8 (consistency): 14 concept groups with near-duplicates, 5 of them mixed English/BM or contradictory (generic server text, 403/500 page copy, 415/413 text, rate-limited, not found).
Catalogue (final): 102 ERR rows in section 9: 52 carry V2 / PRD / existing-code copy, 48 are [PROPOSED] copy, 2 have no user text (see §12). Code defects: D1-D7 plus D8 (English reward messages). Open questions: none blocking; one-time user approval of the 48 [PROPOSED] copy rows (§10 resolution table).

### Top 15 gaps
1. PRD has no error-handling section; NFR-7 is one sentence. Add the section X10 (this file, sections 2 and 9).
2. Server sends English default messages (401/403/404/409/422/500/413) against the "BM on the wire" rule (D1).
3. No 401 flow: no return URL, no message, unsaved work lost (D3, ERR-AUTH-01).
4. Unmapped 4xx (415, 405, 408) answered as 500 with a stack log (D2).
5. FE `ApiError` has no `requestId`/`details`; reference ID cannot be shown; 502/503/504/413/415 collapse to SERVER_ERROR (D4).
6. No timeout/retry/backoff policy anywhere (2A-bis).
7. No offline/online global banner; offline is handled only in Bijak.
8. Bijak submit treats all errors as offline and retries forever (D5).
9. 403/500 page copy conflicts between the PRD and the code; no maintenance page (D6, 2D).
10. No toast/inline/page rule and no double-submit or optimistic-update rule (2C, 2.6, 2.7).
11. Concurrency is only half covered. Corrected: questions ARE versioned (live version, `edit-as-draft` creates n+1, 409 `CONFLICT` with `details.versionNo` when a draft exists), so two admins on a live question is handled (ERR-CON-02); only two admins saving the **same draft** or the same Set Builder paper has no protection (optional `expectedUpdatedAt`, ERR-CON-02b), and the PRD states none of it (6.1).
12. No generic form messages (required/too long/format/file size/type) and no first-error focus rule (3.x).
13. Upload limits conflict (CSV 2 MB vs 5 MB, body 1100 kB) and no progress/cancel/retry spec; OCR timeout has no number.
14. Limits live only in code, not in the PRD NFR table: question-report daily cap 20 (resolved: Laporan Soalan, ERR-QUOTA-02), intake 10 files / 5 batches / 500 pages a day / 20 writes and 240 reads per min, login 5 per min + 20 failures per min per address + 100 failures per 15 min per identifier, global 300 per min, server timeouts 120 s / 60 s / 65 s.
15. Message duplicates to unify (retry button `Cuba Semula`/`Cuba lagi`, rate-limited x3, save-failed x6, offline x5, "ditemui"/"dijumpai").

### Open questions: resolution (second pass)
| OQ | Decision | Reason |
|---|---|---|
| OQ-ERR-1 (404 button `Mula Latihan` for staff) | **[PROPOSED-DECIDED]** show `Mula Latihan` for Murid only; staff see `Halaman Utama` only | The target `/practice` is a pupil screen; a staff link to it would open 403/404 (a FR-X2-3 style dead link, D9 "broken" class). The live copy of the button is kept for the pupil. |
| OQ-ERR-2 (late submit vs closed) | **[PROPOSED-DECIDED]** keep the working code: the server decides. Answers saved up to the deadline + 30 s are counted; an auto-submit at 0 is sent by the client (`auto: true`); if the server answers `closed`, the pupil sees ERR-SAVE-05 (existing text) and the result. FR-MUR-13-11 "a late submit is accepted" is reworded to "a submit sent by the timer or within the 30 s grace is accepted" | Follows `autosave.ts:36,140-144` and `AttemptPage.vue:200-205,413` (working V2-aligned behaviour: V2 words verbatim, AC-R1-05.1); no code rewrite. |
| OQ-ERR-3 (daily cap 20) | **RESOLVED by docs**: pupil/teacher **question report** cap, 20 per reporter per Malaysia day (OQ-API-06 in 60:1276 and 60:462; OQ-MUR-15 and plan S5-T06 aligned to 20; code `reports.ts:55`, `reports.service.ts:153-158`; text "Anda telah mencapai had 20 laporan sehari. Sila cuba lagi esok.") | Contract value is enforced and tested. |
| OQ-ERR-4 (approve new BM copy) | **[PROPOSED-DECIDED]** rows carrying V2 or existing-code text need no approval; rows still tagged [PROPOSED] are listed in the table below and go to the user once, as one batch, at G1 | NFR-2 / D94 only require approval for new copy; the batch is small. |
| OQ-ERR-5 (versioning) | **[PROPOSED-DECIDED]** reuse the existing version model (live version, `edit-as-draft`, `versionNo`, existing 409) and add only an **optional** `expectedUpdatedAt` on draft/paper saves (ERR-CON-02b). No locks | Improve, not rebuild; optional field is backward compatible; the existing 409 already covers the live-question case. |

**Still needs the user:** only the one-time approval of the [PROPOSED] BM copy batch (below). No blocking OQ remains.

## 11. V2 capture sweep (all role folders: guru, admin-sekolah, admin, panel, murid, murid-data; 328 `.txt` files)

The captures are static page dumps, so they hold very few real error states. Observed V2 notices that matter for the catalogue (exact text):

| V2 text | Where observed | Catalogue use |
|---|---|---|
| Gagal memuat senarai. | admin users, import students, Kirkpatrick, users create/bulk import (with `Cuba lagi`) | ERR-SYS-01b (admin list load failure) |
| Terdapat kerja yang belum disimpan daripada sesi sebelum ini. | Studio question create/edit (admin and admin-sekolah) | draft restore notice (2.1, ERR-AUTH-01, ERR-SYS-06) |
| Sila pilih subjek dan tahap pendidikan | admin curriculum | empty/initial state; also 30:812 |
| Soalan ini belum diterbitkan; pelajar tidak dapat melihatnya lagi. | Studio preview | already in 30 (draft preview) |
| Pilih soalan untuk menyunting. / 32 soalan lagi diperlukan. | SPM Tracking A editor | already in 30:671-674 |
| Belum ada data untuk dianalisa | pupil Analisa Item | empty state |
| Belum ada percubaan SPM | pupil SPM history | empty state |
| Belum ada data prestasi lagi. Mula latihan → | pupil Prestasi | empty state with next action |
| Belum ada sasaran headcount daripada cikgu untuk sesi 2026. | pupil Prestasi | empty state (no data is not a negative result, FR-X4-3) |
| Belum ada latihan untuk {Subjek}. Mula berlatih untuk membuka analitik penuh. | pupil Analitik Adaptif (per subject) | empty state with next action |
| Belum ada sekolah yang menyertai battle. Mulakan pertandingan sekarang! | Battle school ranking (pupil and admin) | empty state |
| Tiada pelajar dijumpai | pupil battle | filtered-empty |
| Belum ada audio diterbitkan / Belum ada set Audio KBAT. | pupil / admin Audio KBAT | empty state |
| Belum ada data latihan. | teacher Prestasi Kelas | empty state |
| Belum ada pelajar dalam kelas anda — data impak tidak dapat dianalisis lagi. | teacher Kirkpatrick | empty state (already in 20:718) |
| Tiada tiket lagi. | teacher support tickets | empty state |
| Tiada kelas lagi / Tiada pelajar dengan sekurang-kurangnya 5 soalan minggu ini. | teacher weekly report | empty states |
| Tiada video buat masa ini | teacher Video | empty state |
| Tiada aktiviti minggu ini. | admin Command Center | empty state |
| Tiada laporan soalan untuk status ini. | admin question reports | filtered-empty |
| Tiada soalan | pupil Latih Tubi per Bab (count 0 chip) | zero-count label |
| Tiada soalan perlu diulang kaji! | pupil revision | success-empty state |

Findings: V2 shows **no** captured toast/validation/401/403/500 text. The V2 error pages, form validation text, upload failure text and offline text are therefore **not observed** and stay at "PRD 20 s X / code / [PROPOSED]". The empty-state vocabulary in V2 uses `Belum ada ...` (never had) and `Tiada ... ` (filtered/period/zero), which confirms the rule proposed in section 8 (row "Empty states").

## 12. Copy status after the second pass (rows of section 9 that carry an error copy)

Counting each ERR row (a row with several sub-codes counts once; ERR-RWD-02..08 counted separately).

| Source of the BM text | Rows | IDs |
|---|---|---|
| V2 (observed or quoted in PRD from V2) | 6 | ERR-SYS-01b (admin lists), ERR-AUTH-01 draft notice, ERR-SAVE-01 (Bijak status words), ERR-QUOTA-01, ERR-QUOTA-03 (teacher upload text), ERR-AUTH-02..04 count under code below |
| Existing code/contract text (BM, exact) | 36 | ERR-SYS-05, ERR-AUTH-02, -03, -04, -05, -06, -07, -08, -09; ERR-REQ-05; ERR-QUOTA-01, -02; ERR-PRAC-01..07 (7); ERR-WAL-01; ERR-RWD-01..08 (8); ERR-BIJ-01..06 (6); ERR-SAVE-05, -07; ERR-QST-02; ERR-INT-12 (n/a text) excluded |
| Existing PRD text (quoted from 10/20/30) | 8 | ERR-QST-01, -03, -04; ERR-BIJ-04; ERR-INT-10; ERR-ACC-01 (route), ERR-ACC-02/03 (404 page), ERR-SYS-01 (500 page) |
| [PROPOSED] (no V2/code/PRD copy; new BM text) | 44 | ERR-NET-01, -02, -03; ERR-SYS-02, -03, -04, -06, -07; ERR-ACC-01 (action), -04; ERR-REQ-01, -02, -03, -04, -06, -07, -10..16 (7); ERR-RATE-01 (merged text); ERR-QUOTA-03 (admin), -04, -05, -06, -07; ERR-CON-01, -02, -02b, -03, -04; ERR-INT-01..09, -11; ERR-SAVE-02, -03, -04, -06; ERR-EXP-01, -02; ERR-IMP-01, -02 |
**Authoritative recount (supersedes the per-source row counts above, which overlap):** section 9 has 102 ERR rows. **52 rows carry V2 / PRD / existing-code copy; 48 rows keep new [PROPOSED] BM copy; 2 rows have no user text** (ERR-NOT-01 logged only, ERR-INT-12 a defect to fix). The 48 [PROPOSED] rows are the one-time approval batch for the user: ERR-NET-01..03; ERR-SYS-02, -03, -04, -06, -07; ERR-ACC-04; ERR-REQ-01, -02, -03, -04, -06, -07, -10..16; ERR-QUOTA-03 (admin), -04, -05; ERR-CON-01, -02, -02b, -03, -04; ERR-INT-01..09, -11; ERR-SAVE-02, -03, -04, -06; ERR-EXP-01, -02; ERR-IMP-01, -02. Of these, many have a close existing sibling (ERR-REQ-10..16 follow "Nama diperlukan." / "Sila pilih Bab."; ERR-INT-* follow the 9 contract codes; ERR-SAVE-02 follows 30:605) and carry low risk.

Exact values filled in this pass: login throttle (5/min per identifier+address, 20 failures/min per address, 100 failures/15 min per identifier, retryAfter 1-900 s); server timeouts (request 120000, headers 60000, keep-alive 65000, shutdown grace 25000 ms); intake (10 files per batch, 5 active batches, 500 pages/day, writes 20/min, reads 240/min, upload concurrency 2); global limit 300/min; question-report cap 20/day; REWARD_ERRORS and NOT_SUBMITTED texts (rows ERR-RWD-02..08, ERR-BIJ-06).
