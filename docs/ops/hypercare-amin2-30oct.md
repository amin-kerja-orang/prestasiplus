# HYPERCARE-AM2: half-AM module watch, 30 Oct to 6 Nov 2026

| Field | Value |
|---|---|
| **Status** | **Draft: Perlu pengesahan LEAD** (written 25 Oct 2026 against `feature/v2-backend` tip 4078bf53; PR and merge states below are those of that date and must be re-read before 30 Oct) |
| **Purpose** | Map what a user or support will report in the first week to the first read-only check, the owning PR or decision, who responds, and whether it can ever be a rollback trigger. |
| **Does not replace** | The plan hypercare paragraph ([v2-cutover-plan.md](v2-cutover-plan.md), "Hypercare (30 Oct to 6 Nov)", line 563), the P11 daily smoke rows H-n ([../qa/p11-production-smoke.md](../qa/p11-production-smoke.md), sections 3 and 4; newer text in PR #343), the runbooks ([production-vps.md](production-vps.md) sections 8, 10, 11, 21; [api-runbook.md](api-runbook.md) sections 4 and 9; [production-migration-slot.md](production-migration-slot.md); [v2-migration-runbook.md](../architecture/v2-migration-runbook.md)). It adds only the module-symptom layer. |
| **Rules** | Counts only. No names, e-mails, IC, usernames, ids of people or free text in any result. Results are posted as text in the cutover issue thread. Production actions (deploy, rollback, restart, SQL writes) need the LEAD's explicit confirmation. |

## 1. Scope, window and owners

- **Window:** 30 Oct to 6 Nov 2026 (the plan hypercare window). Support hours follow production-vps.md section 21 (every school day, 07:00 to 18:00 MYT).
- **Modules watched:** M01 (login and account), M02 (users and schools), M08 (student performance), M10 (teacher classes), M11 (teacher analytics), M17 (admin dashboard), M27 (school admin), plus the migration-facing items.
- **Owners (roles only):**

| Role | Does |
|---|---|
| Amin2 on-call developer | First responder for the module rows in section 2; triages, finds the PR or decision, prepares the fix on a branch. Never touches the server. |
| Amin1 migration | Responder for the "Migration-facing" rows (loaded data, flags, tiers, reference seeds). Types `migrate:*` only as the plan allows (decision 7). |
| Half AZ DevOps | Runs read-only logs and SQL on the host, health and readiness, deploy and rollback mechanics when the LEAD confirms. |
| LEAD | Decides rollback (R4, R5, R-b), dated exceptions to the after-go-live train, and all production deploys. |

- **Relation to the daily smoke:** the P11 H-n run (health, readiness, four v2-born accounts) comes first each day. If an H-n row fails, that is trigger R4 and is handled by the plan, not by this document. This document applies when the smoke is green and a symptom is reported.

## 2. Symptom table

Read-only checks Q1 to Q7 are in section 3. "Log" means: on the host, `docker compose ... logs --since 30m api`, filtered by HTTP status and route (the edge log line carries `rid=`; follow one request by `requestId`, production-vps.md section 11). Expected errors (`ApiError`) are not written to the API log with their code: only 500s are logged with a stack (`all-exceptions.filter.ts`). So for 4xx the evidence is the response body the user or support copies, plus the request line by status. Whether the request line field names are `"statusCode"` and `"url"` is **Perlu pengesahan** (half AZ checks one real line on 30 Oct).

Rollback column: **No** = never a rollback trigger, fix-forward by the train; **Escalate** = tell the LEAD at once, who judges against R4 (plan 6.1) or R5, and R-b only inside the switch + 4 hours deadline (plan 6.2).

| Module | User-visible symptom | Route(s) and status or code | First read-only check | Mapped PR, item or decision | Responds | Rollback trigger? |
|---|---|---|---|---|---|---|
| M01 | Sign-in succeeds but every next page fails; banner or empty screen. Message: "Sila tukar kata laluan anda sebelum meneruskan." The front end has no screen for it until #226 and #357 land. | Any authenticated route: 403 `PASSWORD_CHANGE_REQUIRED`; only `GET /api/session`, `PUT /api/me/password` and logout pass | Q1 (flagged count, trend) | R39-C4 (R39 #256, #268); screen in #226 and #357; migrated roster, shared-default and non-bcrypt accounts | Amin2; school admin resets | **No** for a migrated account (expected, accounts are flagged by design). **Escalate** only if a v2-born smoke account is locked out (that is R4). Fallback: school-admin or Admin Pusat password reset clears the flag (production-vps.md section 21). |
| M01 | "E-mel/Nama pengguna atau kata laluan tidak sah." for a roster username that the user is sure about | `POST /api/auth/login`: 401 `INVALID_CREDENTIALS` | Q1 (is the account flagged or without a hash), Q7 (username repeated) | A1.11 (f) and (g) in rehearsal notes; password carried or not | Amin2, Amin1 | **No** |
| M01 | "Nama pengguna ini wujud di lebih daripada satu sekolah. Sila pilih sekolah anda." and no way to choose | `POST /api/auth/login`: 422 `AMBIGUOUS_USERNAME` with `details.schools`; the SPA sends no `schoolId` | Q7 (count of repeated usernames) | #226 comment on the PR; fix status **Perlu pengesahan** | Amin2 | **No** (affects named accounts only); LEAD may judge R5 if it is widespread, which it should not be |
| M01 | "Terlalu banyak percubaan. Sila cuba lagi dalam 15 minit." for pupils of one school at once (IC reset) | `POST /api/auth/password/reset-ic`: 429 `RATE_LIMITED`, `retryAfter` (text `resetIcRateLimited`; the generic "Terlalu banyak percubaan. Sila cuba sebentar lagi." applies to login) | Q3 (live per-address IC-reset rows against distinct address hashes); half AZ checks `TRUST_PROXY_HOPS` against the proxy count | M01 BUG-01, #355 (draft), decision M01-B1; api-runbook.md section 9 | Amin2, half AZ | **No** (fix-forward); a wrong `TRUST_PROXY_HOPS` is a config fix by half AZ with the LEAD's confirmation, not a rollback |
| M01 | "Where is the reset e-mail?" | `POST /api/auth/password/email`: 200 but nothing is sent | none (by design) | AM-18 A; school notice N9; production-vps.md section 21 | Meja Bantuan | **No** |
| M01 | Registration refused: "Pendaftaran akaun baharu ditutup buat sementara waktu. Sila cuba lagi kemudian." Referral code not credited | `POST /api/auth/register`: 403 `REGISTRATION_CLOSED` | Q6 (v2-born user growth stays flat while closed) | `REGISTRATION_OPEN=false` at go-live; #352 must merge before reopening | Amin2 | **No**; reopening needs the LEAD and #352 first |
| M02 | Renewal invoice page opens but its student table is empty | `GET /api/admin/school-subscriptions/{id}/renewal-invoice`: 200 | Q4 (subscriptions exist) and Q5 (enrolments exist), then the log for 5xx on this route | M02 BUG-01, #354, #356 | Amin2 | **No** |
| M02 | Admin user or school list slow, 5xx, or blank | `GET /api/admin/users`, `GET /api/admin/schools`: 500 `SERVER_ERROR` | Log level 50 by route; Q2 for tiers if the failing page is a student dashboard | BM server-error copy: #345; plan R5 if sustained | Amin2, half AZ | **Escalate** when the 5xx rate stays above the R5 threshold for the stated time; otherwise **No** |
| M08 | Student dashboard or wallet shows an error. Server text: "M14: no tier is defined" (a 500, not shown to the user) | Student dashboard and wallet routes: 500 `SERVER_ERROR` | Q2 (`tiers` count is above zero); log level 50 | P11-B1; #230 inside #310; BM server-error copy #345; fallback P11 step 7a or `deploy.sh --seed-reference` on R3+ | Amin1, half AZ | **Escalate**: many students affected at once is a wrong-data or 5xx pattern (R5), and the LEAD decides between the seed fallback (fix-forward, preferred) and R-b. A single account is **No**. |
| M08 | Two screens show different figures for the same pupil | `GET /api/performance/students/{userId}`, `GET /api/analytics/me` | none (documentation item) | M08 B3, doc only; accepted drift (runbook 17 item 4) | Amin2 | **No** |
| M08 | Wallet balance differs from what the pupil expects | wallet routes: 200 | Block C of [sql/smoke-readonly.sql](sql/smoke-readonly.sql) (balance against ledger) | R4 wording "wallet against ledger" | Amin1 | **Escalate** if the same wrong figure appears for many accounts (R5) or the SQL differs from the verify report (R4); a single account is **No** |
| M10 | Admin opening the teacher class list sees "Gagal memuatkan senarai kelas" | `GET /api/guru/classes`: 4xx or 5xx for the Admin Pusat role | Log by route and status; Q5 | M10 B1, #350 | Amin2 | **No** |
| M10 | Class or student picker lists the wrong entries or is empty | `GET /api/guru/students`, `GET /api/guru/classes` | Q5 (classrooms and enrolments exist, not falling) | M10 B2, #347 (class-create school picker only) | Amin2 | **No**, unless Q5 shows migrated classes or enrolments missing, which is a migration defect: **Escalate** to the LEAD (R4 if the SQL differs from verify) |
| M11 | Totals on S2 differ from S3 or S5 | `GET /api/guru/dashboard`, `GET /api/performance/classes`, `GET /api/performance/classes/{id}` | none (compare the three screens only) | M11 S2 against S3/S5, #349, M11-B5 | Amin2 | **No** |
| M17 | Back link on S2 loops between two screens | none (front end only) | none | M17 S2, #348 | Amin2 | **No** |
| M17 | Command centre live data empty or errors | `GET /api/admin/command-center/live-data`, `GET /api/command-center/daily-activity`: 200 or 5xx | Log by route and status; Q5 | plan R5 only when 5xx is sustained | Amin2 | **No**, or **Escalate** under R5 |
| M27 | School admin sees layout problems (the S8 class table at 768 px wide, #340; other layout items #351) | `GET /api/admin-sekolah/dashboard`, `/guru`, `/pelajar`: 200 | none | M27 layout items, #351; #340 (S8 class table fits at 768 px only) | Amin2 | **No** |
| M27 | School admin cannot reset a teacher or pupil password | `POST /api/admin-sekolah/guru/{id}/reset-password`, `POST /api/admin-sekolah/pelajar/{id}/reset-password`: 404, 403 or 422 | Log by route and status | BM copy of the 422 alerts: #359. This is the fallback for the R39-C4 lockout, so a failure here raises M01 severity | Amin2 | **Escalate** if the reset itself fails for several schools: it blocks the only recovery path (judge under R4/R5) |
| Migration-facing | Pupil or teacher missing from a class, wrong school, or duplicate account | various | Q5, Q7; the verify and recon figures in the cutover thread | A1.11 notes; verify report | Amin1 | **Escalate** if the same pattern hits many accounts (R5); R-b only inside the deadline and only by the LEAD |
| Migration-facing | Help box on the support page says not found | `GET /api/config/support`: 404 `NOT_FOUND` | none | production-vps.md section 21 finding F10; notice and Q27 support channel | Meja Bantuan, Amin1 | **No** (contact is in the school guide) |
| Migration-facing | Questions or reports missing after load | question routes | counts in the verify report only | `migrate:link-questions` may run at any time after cutover (plan line 563) | Amin1 | **No** |

## 3. Read-only checks (counts only)

Run by half AZ on the host through the read-only `q` helper or `psql`, one read-only transaction holding the seven SELECTs. Post the numbers as text in the cutover thread; never paste rows. A result below is compared with the first reading of the day (trend), not with a number in this document.

```sql
BEGIN TRANSACTION READ ONLY;
-- Q1 forced-change accounts still flagged (should fall as people change or are reset)
SELECT count(*) AS flagged FROM users WHERE must_reset_password;
-- Q2 tiers defined (must be above zero, else student dashboard and wallet return 500)
SELECT count(*) AS tiers FROM tiers;
-- Q3 live per-address IC-reset throttle rows against distinct address hashes (hashes are never printed)
-- identifier_hash is '<prefix>:<hmac>', prefix 'reset:ic-ip' (account.constants.ts); per-account keys store ip_hash 'any'
SELECT count(*) AS live_rows, count(DISTINCT ip_hash) AS distinct_addr
  FROM login_attempts
 WHERE expires_at > now() AND identifier_hash LIKE 'reset:ic-ip:%' AND ip_hash <> 'any';
-- Q4 school subscriptions present
SELECT count(*) AS subscriptions FROM school_subscriptions;
-- Q5 classrooms and enrolments present
SELECT (SELECT count(*) FROM classrooms) AS classrooms, (SELECT count(*) FROM enrolments) AS enrolments;
-- Q6 v2-born users (growth stays flat while registration is closed)
SELECT count(*) AS v2_born FROM users WHERE legacy_source IS NULL;
-- Q7 usernames shared by more than one account (AMBIGUOUS_USERNAME exposure)
SELECT count(*) AS repeated_usernames FROM (
  SELECT lower(username) FROM users WHERE username IS NOT NULL GROUP BY 1 HAVING count(*) > 1) d;
ROLLBACK;
```

Column and table names are taken from `docs/ops/sql/smoke-readonly.sql` and the API sources; confirm them once on a restored copy before 30 Oct (**Perlu pengesahan**: Q3 `ip_hash`/`expires_at`, Q6 `legacy_source IS NULL` for v2-born). Postgres refuses any write inside a READ ONLY transaction, so a typo cannot change data.

## 4. Daily routine

| When (MYT) | Who | What | Posted |
|---|---|---|---|
| Morning, before school traffic | Half AZ | P11 H-n smoke (health, readiness, four accounts); then Q1 to Q7; `smoke-readonly.sql` blocks C and F once | One result line per P11 section 3.6, plus the Q-numbers as text, in the cutover issue thread |
| Midday | Amin2 | Review support tickets by symptom against section 2; count per row (a tally, no names) | Tally line in the thread |
| End of school day | Half AZ | Error-level log count and 5xx share against R5; reset-request volume (expected spike, runbook 17 item 3) | One line in the thread |
| Any time | Anyone | A wrong-data pattern or a failed H-n row | Tell the LEAD at once |

On 6 Nov the LEAD closes hypercare in the thread and decides the smoke accounts (P11 open question 7).

## 5. Escalation and fix-forward

1. Match the symptom in section 2. If the row says **No**, log it, tally it, and give the user the fallback (school-admin or Admin Pusat reset; Meja Bantuan).
2. If it says **Escalate**, Amin2 tells the LEAD with the evidence (route, status, Q result as text). The LEAD decides whether it is R4, R5 or neither. R-b and restore of `pre_etl` are daytime procedures only inside the switch + 4 hours deadline (plan 6.2/6.3); after it, fix forward.
3. Fix-forward follows the after-go-live train order as simulated in the TRAIN-AM2-PG simulation on #109: a fix goes on a branch, passes its tests and review, and reaches production through the normal deploy (production-vps.md section 7) on the LEAD's confirmation.
4. A dated LEAD exception can pull a fix ahead of its train slot. The exception is written in the thread with the date, the PR number and the reason, and covers that one PR.
5. **Never hot-patch the server.** No edits on the host, no SQL writes, no manual flag changes. A data correction goes through a reviewed migration or script, run by the person the plan names, with the LEAD's confirmation.
6. PDPA: a suspected incident is R6 and goes to the LEAD at once. Do not copy user data into tickets or GitHub.

## 6. Open questions (Perlu pengesahan)

1. **AMBIGUOUS_USERNAME:** the SPA sends no `schoolId`; whether a fix for the login picker has merged or is still open is not confirmed (#226 comment on the PR). Until confirmed, the row stays "No rollback" with Q7 as the exposure check.
2. **PR states on 30 Oct:** #226, #357, #310 (contains #230), #355, #352, #354, #356, #350, #347, #349, #348, #340, #351, #345, #359 are listed as of 25 Oct; Amin2 re-checks which are merged and deployed on the morning of 30 Oct and updates section 2.
3. **Log field names** for the request line (status and URL) and whether the error code is logged for 4xx.
4. **Q3 and Q6 column semantics** (see section 3).
5. **Support channel and notice N9 text:** the contact values are the LEAD's (production-vps.md section 21); this document holds none.
6. **Severity of M08 "no tier" for a single account:** treated as No; the LEAD confirms the threshold between one account and a pattern.
7. **Who may type the seed fallback** (`deploy.sh --seed-reference`) during hypercare: default is half AZ on the LEAD's confirmation.
8. **Whether the LEAD wants daily results as one line or the Q-numbers in full.**
