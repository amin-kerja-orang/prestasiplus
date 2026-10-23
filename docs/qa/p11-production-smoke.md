# P11: production smoke accounts and smoke checklist

| | |
|---|---|
| **Status** | Draft (23 Oct 2026). Nothing in this document has been run on any server. |
| **Purpose** | Define the four v2-born smoke accounts (student, teacher, parent, admin), how they are created while self-registration is closed, and the sign-in checklist for 28 Oct (baseline) and 30 Oct (C2, before and after the DNS switch; repeated daily in hypercare). |
| **Owner** | QA, half AZ (G5 owner, [cutover plan](../ops/v2-cutover-plan.md) section 2, QA row, line 49). |
| **Prepared by** | Half AM (Amin2, AM2-Dev1) as help to half AZ. Docs only: no code, no data, no server was touched. |
| **Cutover plan links** | Section 3 P11 (line 88); A5 step (3) (line 191); C2 (line 216); section 4.5 "Smoke checks (no sign-in as a real minor)" (lines 278-284); section 5 criterion 9 (line 421); section 6.1 trigger R4 (line 447); section 6.3 R-b (line 465); section 7 "Hypercare" (line 521). |
| **Related open PRs** | #220 (run sheets: `pre-night-28oct.md` Step 3 and Q18, `vps-dark-setup-26oct.md` Q18 and step 11); #221 (REG-CLOSE, the switch that closes self-registration). |
| **Read against** | `feature/v2-backend` at 515e440f. File:line references below are on that sha unless marked "#221 branch" (`ops/AZ-reg-close`). Frontend facts were cross-checked on `be/integration-frontend` (29d85187). |
| **Marker** | **Perlu pengesahan** = not verified in the repo or not decided; do not treat as fact. |

## 0. Rules for everyone who runs this

1. **No secret in the repo, an issue, a PR, chat or a log.** No password (not even a demo one), e-mail, token, address or name appears in this file or in the evidence. Results go into the cutover issue as text: role, Pass/Fail, time. Placeholders used here: `<smoke-student>`, `<smoke-teacher>`, `<smoke-parent>`, `<smoke-admin>`, `<smoke-school>`, `<vps-url>`.
2. **Never sign in as a migrated (real) pupil, teacher or parent.** Section 4.5 of the plan allows only the four v2-born accounts.
3. **Writes are limited to the smoke accounts' own rows.** Sign-in, sign-out and the forced password change write session, audit and last-login rows of the smoke accounts only. Do not submit a practice session, an answer, a ticket or a paper (see open question 9).
4. **One sign-in per role per run, no retry loops.** Failed logins are throttled per client address (`docs/ops/production-vps.md` section 20, F2, "fixed login limit of 20 failed attempts per minute per address"); a lock-out by QA would also hit the operator and AZ on the same address. A wrong password is a Fail, not a reason to retry.
5. **Credentials** are held by the QA operator in a password manager, outside the repo. Each account has its own unique password. Nothing is dictated, pasted into chat or typed into a shell line (the admin bootstrap uses its hidden prompt, section 2.3 step 1).

## 1. The four accounts (roles only)

| Role | Purpose | Needs a school | Born in v2 | Kept or removed after cutover |
|---|---|---|---|---|
| `<smoke-student>` (role `student`) | Sign-in checks only: sign in, land on the student dashboard, start the first-login flow (open question 9), sign out. | Not required to sign in (student scope is `self`, `apps/api/src/modules/auth/session-view.ts:102-103`). **Default: put it in `<smoke-school>`**, because every real pupil has a school (open question 6). Grade 1 to 11 is required (`packages/contract/src/users/schema.ts:270`). | Yes, created by an Admin Pusat in v2 on 28 Oct. Never migrated, no `legacy_*` value, no link to any migrated row. | LEAD's choice (open question 7). Default: keep through hypercare (to 6 Nov), then deactivate. |
| `<smoke-teacher>` (role `teacher`) | Sign-in checks only. | **Yes, `<smoke-school>` is mandatory.** A teacher without a school has no scope and cannot get a session (`session-view.ts:97-99`; refused at login as `ACCOUNT_INACTIVE`, `auth.service.ts:164-167`). The school must stay active (`auth.service.ts:157-160`, `SCHOOL_INACTIVE`). | Yes. | As above. |
| `<smoke-parent>` (role `parent`) | Sign-in checks only. No child linked (open question 5). | No (scope `self`). | Yes. | As above. |
| `<smoke-admin>` (role `admin`, Admin Pusat) | Sign-in checks, and it is the account that creates the other three on 28 Oct. | No (national scope). | Yes, created by the host command `admin:bootstrap` (section 2.2). | As above, but see open question 2: it is a national-scope account, so it is the first to deactivate. |

Common to all four:

- **Created in daylight on 28 Oct, before the `pre_etl` restore point** (A5 step 3, plan line 191; run sheet #220 `pre-night-28oct.md` Step 3, planned 11:00). A restore of `pre_etl` then keeps them. They are not created on 29 or 30 Oct. If a schema migration is applied after the points were taken, the points are taken again (plan A5 step 2) and the accounts are simply still there.
- **After cutover rollback Procedure B** (`migrate:rollback`, plan section 6.3 R-b, line 465), v2-born rows are kept. A rollback also refuses, with nothing changed, if a v2-born row references a migrated row (plan line 465; the exit code of that refusal is **Perlu pengesahan**, because `migrate:rollback` is not on `feature/v2-backend` and the plan gives exit 2 only for the running-apply refusal). The accounts are built to avoid that: the parent is not linked to a pupil, the student and teacher sit in `<smoke-school>`, which has no migrated class or pupil.
- **Login name is an e-mail address.** The SPA login form has only "Alamat Email" (`src/modules/m01-authentication/pages/LoginPage.vue`, `<DsFormField ... label="Alamat Email">`), so each account needs an e-mail-shaped login (open question 8). The address is stored in the password manager only.
- **Forced password change.** An account made by an admin or by the bootstrap command carries `must_reset_password = true` (`users.service.ts:196,215`; `admin-bootstrap.ts:189`). Until it is cleared, every route except `GET /api/session`, `PUT /api/me/password` and logout answers 403 `PASSWORD_CHANGE_REQUIRED`, "Sila tukar kata laluan anda sebelum meneruskan." (`password-change.guard.ts`; `apps/api/src/common/errors/api-error.ts:13`). The SPA only types the flag (`src/stores/http-session.ts:39` on `be/integration-frontend`); it has no screen or handling for it (tracked as BUG AM2-A1 on #113, fix in progress). **Clear it on 28 Oct** (section 2.3 step 6). It also matters for the plan's SQL check "number of accounts marked for a forced password reset equals the expected number" (plan 4.5 part 1): four flagged smoke rows would add 4 to the figure.

## 2. Creation path while registration is closed (answer to Q18 of #220)

### 2.1 What REG-CLOSE (#221) blocks

Only `POST /api/auth/register` (student, teacher, parent self-registration). With `REGISTRATION_OPEN=false` it answers 403 `REGISTRATION_CLOSED` before the body is read (`registration.service.ts:54-55` on the #221 branch; `deploy/vps/api.env.example` sets it false until go-live). Login, password reset, admin-created accounts and the host bootstrap command are not blocked; the #221 spec `apps/api/test/account/register-closed.spec.ts` proves the admin route and `apps/api/test/ops/admin-bootstrap.spec.ts` proves the CLI with the switch off.

Note: the run sheet #220 `vps-dark-setup-26oct.md` says the repo has no setting that closes registration; #221 adds it. #220 `pre-night-28oct.md` Step 3 still names self-registration as the path for student, teacher and parent; with #221 in production that path is closed.

### 2.2 Existing paths per role

| Role | Existing path (file:line on 515e440f) | Who may call it | Blocked by REG-CLOSE | Needs a school first |
|---|---|---|---|---|
| admin | Host command `npm run admin:bootstrap -w @pp/api -- --mode=create --email=<e-mail> --confirm=<same e-mail> [--name=...]` (`apps/api/package.json:18`; `apps/api/src/ops/admin-bootstrap/cli.ts`; usage text `admin-bootstrap.ts:52-58`). Creates a national-scope Admin Pusat, `must_reset_password = true`, one audit row (`admin-bootstrap.ts:185-221`). **Refused (exit 3) while any active Admin Pusat exists or the e-mail exists** (`admin-bootstrap.ts:186-187`); true on 28 Oct (no migrated admin until 29 Oct). Password is never an argument: hidden prompt, or `--password-stdin` (`admin-bootstrap.ts:10-11`). Run sheet: #220 `vps-dark-setup-26oct.md` step 11. | A person with a shell on the host, inside the `migrate` image. No HTTP route reaches it (`cli.ts:2-4`). | No (#221 spec line "works with REGISTRATION_OPEN=false"). | No |
| school (for the teacher) | `POST /api/admin/schools`, SPA `/admin/schools/create` (`apps/api/src/modules/schools/schools.controller.ts:61-62,87-90`; `schools.service.ts:180`). Body: name, code (max 20, unique), type (one of SK, SMK, SJK(C), SJK(T), MRSM, SBP), state (a known state name) (`packages/contract/src/schools/schema.ts:91,143-155`). | Admin Pusat only (`@Roles('admin')`); a school admin gets 403. | No | No |
| student | `POST /api/admin/users` with `roles: ['student']`, SPA `/admin/users/create` (`users.controller.ts:74-75,105-112`; `users.service.ts:168-216`). Needs e-mail or username and a grade (`packages/contract/src/users/schema.ts:262-274`). The server generates the password and returns it once as `generatedPassword` (`users.service.ts:183,215`; contract D59b, `packages/contract/src/users/paths.ts:135`). | Admin Pusat (any role), or a school admin for student and teacher in its own school (`ASSIGNABLE_ROLES`, `schema.ts:30-33`). | No | No (school optional for the admin caller, `users.service.ts:462-471`); default is to use `<smoke-school>` |
| teacher | Same route with `roles: ['teacher']`. The account is created **active** (`users.service.ts:199`); no verification step. | As above. | No | **Yes in practice** (section 1); `schoolId` is optional in the schema (only `school_admin` requires it, `schema.ts:271`) but a teacher without one cannot sign in. |
| parent | Same route with `roles: ['parent']`. | **Admin Pusat only** (`ASSIGNABLE_ROLES.school_admin` excludes parent, `schema.ts:30-33`). | No | No |
| parent link (optional) | Create does **not** store a link: `linkedStudentIds` is only validated (`users.service.ts:179,513-516`). Linking is by invite: the student `POST /api/me/parent-invite` (`parents.controller.ts:66-72`), then the signed-in parent `POST /api/parent-invites/:token/accept` (`parents.controller.ts:81-88`). | student; parent. | No | A student exists; no school needed. |
| any of the three, by self-registration | `POST /api/auth/register` (`account.controller.ts:107`; `registration.service.ts:50-110`). A self-registered teacher is created **inactive and pending** until a school admin verifies it, `POST /api/admin-sekolah/guru/:id/verify` (`registration.service.ts:85,104`; `school-admin.controller.ts:47-52`). | Anyone | **Yes, closed** | Teacher: a school must exist, and a school admin account to verify it. |

**Result: every role has a path; no role is "no path".** The only prerequisite is an Admin Pusat, and that one exists through the host command. No new script is needed.

### 2.3 Proposal (default for the LEAD): admin first, then the admin creates the rest

Run in this order on 28 Oct from 11:00 (run sheet #220 Step 3 plans 11:00 and its STOP is 12:00). `<vps-url>` is the dark address; how QA reaches it is open (Q13 and Q15 of #220).

1. **Bootstrap `<smoke-admin>`** (half AZ DevOps at the host shell, QA present; #220 `pre-night-28oct.md:4`: "The LEAD runs each step by hand on the production VPS (half AZ DevOps and QA may be present; QA does step 3). Every step that changes the server needs the LEAD's explicit go first." So the LEAD runs or approves this command). Use the form in #220 `vps-dark-setup-26oct.md` step 11, hidden prompt, `--mode=create`. The password is generated in the QA operator's password manager and entered at the prompt; it is never spoken, sent or put on a command line. Expected: exit 0 and a line "OK create: user id ... Audit row written." (`cli.ts`). Exit 3 means an active admin already exists: STOP and ask the LEAD (do not use raw SQL or the demo seed).
2. **Sign in as `<smoke-admin>`** on `<vps-url>/login`. Clear the forced change (step 6 below).
3. **Create `<smoke-school>`** at `/admin/schools/create`: a clearly fictitious name and code, type SMK, a valid state, active. (One school only. Open question 6.)
4. **Create `<smoke-teacher>`** at `/admin/users/create`: role teacher, school `<smoke-school>`, e-mail from open question 8. Copy the one-time password straight into the password manager.
5. **Create `<smoke-student>`** (role student, grade 4, school `<smoke-school>`) and **`<smoke-parent>`** (role parent, no school, no linked pupil). Same copy rule. *Check first (open question 4):* the SPA must show the one-time password after create. On `be/integration-frontend` it does (`src/modules/m02-users-schools/pages/UserCreatePage.vue:214-220`); on `feature/v2-backend` 515e440f the SPA code outside the mock does not reference `generatedPassword`, so a password created there would be lost. If the release SPA does not show it, create the three users through `POST /api/admin/users` with the admin session and CSRF token and store the response value directly in the password manager (not in a file, not in shell history). If a password was lost, an admin reset (`PUT /api/admin/users/:id` with `resetPassword: true`, `users.service.ts:226`) issues a new one.
6. **Clear the forced change on each account** (admin first, then teacher, student, parent): sign in once, then `PUT /api/me/password` with `currentPassword`, `password`, `passwordConfirmation` (`packages/contract/src/account/schema.ts:453-458`). It sets the flag false and rotates the session (`profile.service.ts:193-224`). **Perlu pengesahan:** the flag is typed only (`src/stores/http-session.ts:39` on `be/integration-frontend`), with no screen or handling for it or for `PASSWORD_CHANGE_REQUIRED` (BUG AM2-A1 on #113, fix in progress); the profile page has a password card (`src/modules/m01-authentication/components/profile/ProfilePasswordCard.vue`) but whether `/profile` loads while the flag is set is unknown (most `GET`s are refused by the guard). Try the SPA path first on the dark deploy; if it fails, record it as a defect for the owners (open question 3) and use the API call. The public reset flow (`POST /api/auth/password/reset`, `password-reset.service.ts:134`) also clears the flag but needs working mail.
7. **Count (no names), as in #220 Step 3:** `pq "select count(*) from users"` equals 4; schools equals 1; accounts with `must_reset_password` equals 0 (column `must_reset_password`, `apps/api/prisma/schema/identity.prisma:14`).
8. **Run the checklist (section 3) once (run label "RUN-28, 28 Oct")** and only then tell AZ the accounts exist. **STOP** (from #220 Step 3): fewer than four accounts, or the path unknown at 12:00, means do not take the restore points; tell the LEAD, who decides to wait or to go without (then C2 has nothing to use).

Why this is the default: it uses only code that exists on `feature/v2-backend`, needs no change to `REGISTRATION_OPEN`, no script, no schema change and no write by QA to the database; every action is audited (`admin.bootstrap.created`, user and school audit rows).

### 2.4 Fallback options if the default does not work

| Option | When | Cost / risk | Recommended |
|---|---|---|---|
| A. Open registration for a short daylight window (`REGISTRATION_OPEN=true`, recreate api, register student and parent, close again) | Only if the SPA and API cannot create users through the admin route. | Two api recreations on the dark production before `pre_etl`; address is dark but not protected; a teacher still needs a school and a school admin; adds a window that #221 exists to close. Self-registered accounts carry no forced-change flag (`registration.service.ts:101`), which is the one advantage. | No |
| B. A small ops script that inserts the three users | If admin creation is broken and A is refused. | New code on the freeze edge (code freeze is 25 Oct), needs review and security-engineer sign-off; bypasses the audit path. | No |
| C. Skip a role | Parent, if the LEAD accepts that parent is out of the prototype scope at go-live (open question 5). | Plan P11 and trigger R4 (line 447) name "a v2-born smoke account of any role"; skipping needs a dated LEAD line amending plan 4.5 part 2 (line 283). | Only for parent, and only with the LEAD's line |

## 3. Smoke checklist

**How to use.** Copy this section into the cutover issue for each run and fill it as text. Run labels (not the plan's rollback triggers R1 to R6): **RUN-28** (28 Oct, step 3 baseline, after creation), **RUN-30a** (30 Oct morning, C2, before the DNS switch), **RUN-30b** (30 Oct, after the switch), **H-n** (hypercare, once a day to 6 Nov, plan line 521). Times are MYT. Order: global rows G, then one role at a time; sign out between roles. Use a private browser window per role.

**STOP rule.** Any Fail in RUN-30a or RUN-30b is trigger **R4** (plan line 447): **no switch** (RUN-30a), or the LEAD decides a rollback inside the 4-hour window (RUN-30b, plan section 6.2). Do not retry to "make it pass": stop, record the step, time and (without secrets) what was seen, and tell the LEAD. In RUN-28 a Fail means the accounts are not ready: do not tell AZ to take `pre_etl`. A Fail in H-n goes to the LEAD at once.

### 3.1 Global (do once per run, before the roles)

| Step | Check | Expected | Pass/Fail | Time |
|---|---|---|---|---|
| G1 | `GET <vps-url>/api/health` | 200 (liveness, `docs/ops/api-runbook.md:75`) | | |
| G2 | `GET <vps-url>/api/ready` | 200 with `"status":"ready"`, `"db":"up"`, `"migrations":"applied"`; 503 is a Fail (`api-runbook.md:76`) | | |
| G3 | Open `<vps-url>/login` | Login page "Log Masuk - PRESTASIPLUS" (`LoginPage.vue` header comment), no console error, no 5xx in the network list | | |
| G4 | (Information, AZ's probe, copy the result) `POST /api/auth/register` with an empty body, before the switch | 403 `REGISTRATION_CLOSED` while closed; 422 only after AZ reopens registration at the switch (`REGISTRATION_OPEN=true`, #221: `deploy/vps/api.env.example:24-25` on `ops/AZ-reg-close`). Not a QA Fail criterion. | | |

### 3.2 Student `<smoke-student>`

| Step | Check | Expected | Pass/Fail | Time |
|---|---|---|---|---|
| S1 | Sign in with `<smoke-student>` from the password manager | No red alert; the app leaves `/login` (`LoginPage.vue`: success goes to the role landing with no message). Wrong credentials show the server text in a red alert and clear the password field: a Fail here. | | |
| S2 | Forced change (only if the account is flagged; in RUN-28 this is where it is cleared, in RUN-30a to H-n the flag must already be 0) | After the change, the session continues; no 403 `PASSWORD_CHANGE_REQUIRED` on any page. **Perlu pengesahan:** SPA screen not found (section 2.3 step 6). | | |
| S3 | Landing | The server sends `/dashboard` (`session-view.ts:29-37`). Page `/dashboard`, tab title "Dashboard - PRESTASIPLUS", header "Dashboard", subtitle "Selamat datang kembali" (`src/modules/m05-practice/routes/dashboard.ts:10-18`). No error banner, no 401/403/5xx. | | |
| S4 | First-login flow (plan 4.5 part 2: "start the first-login flow"). **Perlu pengesahan:** the plan does not define it (open question 9). Default used here: S1 to S3 including the forced password change, i.e. exactly what a migrated, forced-reset pupil goes through. Do **not** start or submit a practice session. | S1 to S3 pass without a refresh loop, 403 or blank page | | |
| S5 | (Optional, read-only) open `/practice` | Page "Latih Tubi" lists subjects; do not click "Mula Kuiz" (`docs/qa/uat-demo-23oct.md`, UAT-MUR-13/14) | | |
| S6 | Sign out ("Log Keluar", or open `/logout`) | Ends on `/login` with no message (`src/app/router/core-routes.ts:32-45`) | | |
| S7 | After sign-out, open `/dashboard` directly | Redirected to `/login` (route needs a session, `src/app/router/guards.ts:78-81`) | | |

### 3.3 Teacher `<smoke-teacher>`

| Step | Check | Expected | Pass/Fail | Time |
|---|---|---|---|---|
| T1 | Sign in | As S1. A refusal "inactive account" or "school inactive" means `<smoke-school>` or the account was deactivated: Fail. | | |
| T2 | Forced change (RUN-28 only) | As S2 | | |
| T3 | Landing | The server sends `/dashboard`; the SPA moves a teacher to `/guru` (`guards.ts:96-101`, `prototype-scope.ts:276-277`). Tab title "Dashboard Guru - PRESTASIPLUS", header "Dashboard Guru" (`src/modules/m10-teacher-class/routes/dashboard.ts:12-21`). No error banner. | | |
| T4 | Sign out | As S6 | | |

### 3.4 Parent `<smoke-parent>`

| Step | Check | Expected | Pass/Fail | Time |
|---|---|---|---|---|
| P1 | Sign in | As S1. The API accepts the parent (`docs/qa/uat-demo-23oct.md`, UAT-IBU-01: role `parent`, landing `/dashboard`). | | |
| P2 | Forced change (RUN-28 only) | As S2 | | |
| P3 | Landing | **With the default build (`VITE_PROTOTYPE_SCOPE=on`, `compose.yaml:21`, `docker/frontend/Dockerfile:21`; `compose.prod.yaml` does not override it):** parent is not a prototype role (`prototype-scope.ts:42`), so `/dashboard` is out of scope and the page shows tab title "Belum Tersedia dalam Prototaip | PRESTASIPLUS", heading "Belum tersedia dalam prototaip" and "Skrin ini belum termasuk dalam skop prototaip ini. Sila gunakan menu untuk melihat skrin yang tersedia." (`prototype-scope.ts:54-57`; known and by design, `docs/qa/demo-rehearsal-integrated-22oct.md` J-05). Plan 4.5 part 2 (line 283) requires each account to "sign in, reach their dashboard", and R4 (line 447) fails the run if a smoke account of any role cannot do that. So this page is **Pass only with a dated LEAD line** amending plan 4.5 part 2 to accept it for the parent (open question 5); until that line exists the parent row is **not Pass** (record "blocked by LEAD line"). If the release is built with the scope off: **Perlu pengesahan** what a parent sees. | | |
| P4 | Sign out | As S6 | | |

### 3.5 Admin `<smoke-admin>`

| Step | Check | Expected | Pass/Fail | Time |
|---|---|---|---|---|
| A1 | Sign in | As S1 | | |
| A2 | Forced change (RUN-28 only) | As S2 | | |
| A3 | Landing | The server sends `/admin` (`session-view.ts:30`); the SPA redirects to `/admin/command-center` (`core-routes.ts:73`); tab title "PRESTASIPLUS COMMAND CENTER" (`src/modules/m17-admin-dashboard/routes/command-center.ts:104`). No error banner. | | |
| A4 | Read-only: open `/admin/users` | Tab title "Pengurusan Pengguna - Admin Panel", list loads (`src/modules/m02-users-schools/routes/users.ts:11-22`). Do not create, edit or delete anything in RUN-30a to H-n. | | |
| A5 | Sign out | As S6 | | |

### 3.6 Result line (post to the cutover issue)

`P11 smoke <run label> <date> <time> MYT: G <pass/fail>, student <pass/fail>, teacher <pass/fail>, parent <pass/fail>, admin <pass/fail>; failed steps: <ids or none>.` Roles only, no account detail.

## 4. After the cutover

- **Hypercare (30 Oct to 6 Nov):** one repeat of this list per day (plan line 521). Keep the four accounts and `<smoke-school>` active for it; deactivating the school blocks the teacher's and student's sign-in (`auth.service.ts:157-160`).
- **At the end (LEAD's choice, open question 7):** default is to deactivate the four accounts with `POST /api/admin/users/:id/toggle-active` (`users.controller.ts:166-171`) and then `<smoke-school>` with `POST /api/admin/schools/:id/toggle` (`schools.controller.ts:99-105`), deactivating `<smoke-admin>` last. A delete is `DELETE /api/admin/users/:id`; the last active admin cannot be deactivated or deleted (409), so this works only once a migrated admin is active. The LEAD records the date as text.
- **Rotate or destroy** the smoke passwords in the password manager when the accounts are deactivated.

## 5. Open questions for the LEAD (each with a default)

| # | Question | Default |
|---|---|---|
| 1 | Accept the admin-first creation path of section 2.3 as the answer to Q18? | Yes. No script, no registration window. |
| 2 | `<smoke-admin>` is created by `admin:bootstrap` on 28 Oct and is a national-scope account that stays after the migration. Does it count as one of the "two active Admin Pusat accounts" of the F1/Q17 check? | No. The two real admins are the migrated `.cloud` admins (Q17 default); the smoke admin is extra and is deactivated first at the end. Also confirm who sits at the host shell (default: half AZ DevOps, QA present). |
| 3 | **High.** `mustChangePassword` is typed only in the SPA (`src/stores/http-session.ts:39` on `be/integration-frontend`); there is no screen or handling for it or for `PASSWORD_CHANGE_REQUIRED` (BUG AM2-A1 on #113, fix in progress). Every admin-created account and every migrated forced-reset account is flagged. Is this a known gap, and who owns it? | Treat as a defect for the frontend owner to confirm on the dark deploy before 28 Oct. For P11, QA clears the flag by API (section 2.3 step 6). If the SPA path fails for the smoke accounts it will fail for migrated pupils too (plan P10 tells them to set a new password), so record it as a go-live risk, not only a QA note. |
| 4 | Which frontend sha is the release? The one-time password panel exists on `be/integration-frontend` (`UserCreatePage.vue:214-220`) but not on `feature/v2-backend` 515e440f. | Confirm on the dark deploy that `/admin/users/create` shows the password once; else use the API fallback of step 5. |
| 5 | Parent is out of the prototype scope and the production build keeps `VITE_PROTOTYPE_SCOPE=on` by default. Will the LEAD write a dated line amending plan 4.5 part 2 (line 283: each account must "sign in, reach their dashboard"; R4, line 447) so that "Belum tersedia dalam prototaip" counts as Pass for the parent? Is the parent linked to the student? | Yes, ask for the line (sign-in is what P11 tests); until it exists the parent row is "Pass only with the LEAD line", not Pass. Not linked (no child data, no reference to a pupil row). If the scope is switched off for production, repeat P3 and re-decide. |
| 6 | One fictitious active `<smoke-school>` (SMK, valid state) holding the teacher and student? It will appear in the public school search (`GET /api/schools/search`, active schools only) and in admin lists. | Yes, one school, named so that nobody mistakes it. Deactivate at the end (section 4). |
| 7 | Keep or remove the accounts after cutover? | Keep through hypercare (to 6 Nov), then deactivate; delete only on the LEAD's word. They survive a restore of `pre_etl` taken after they were created and a Procedure B rollback. |
| 8 | Login e-mail for each account. | A team-owned mailbox alias per role on a domain the team controls, never a school or pupil domain, and never one that exists in `.cloud` (the e-mail is unique case-insensitively, `users.service.ts:180`; **Perlu pengesahan** for half AM: how `migrate:all` treats a `.cloud` user whose e-mail equals a v2-born one). Addresses stay in the password manager. |
| 9 | What is "the first-login flow" for the student in plan 4.5 part 2? | The forced password change plus landing on `/dashboard` (S1 to S3). No practice is started or submitted, so no v2-born practice, answer or mastery row appears (they could disturb the totals if the SQL checks of 4.5 part 1 are ever compared by entity totals; **Perlu pengesahan** with the AM operator). |
| 10 | Who signs in on 30 Oct and who may hold the passwords? | The QA operator (half AZ), alone, in the password manager; AZ sees the result line only. |
| 11 | Other docs that are wrong or stale (not changed here). | (a) `docs/ops/production-vps.md` section 4 step 11 (line 222) and finding F1 (line 612) say there is no bootstrap command; the code has one. (b) #220 `pre-night-28oct.md` Step 3 and "Script gaps" item 5 name self-registration for the three roles; with #221 it is closed. (c) #220 `vps-dark-setup-26oct.md` says no setting closes registration; #221 adds it. (d) `docs/ops/go-live-bijak-spm.md` section 4.2 (line 364) says production smoke accounts are "unverified / to be created"; this document supersedes that for P11. (e) The C2 row says "four v2-born smoke accounts" while the plan's SQL check counts forced-reset accounts: see section 1, last bullet. |

## 6. Script gaps (cross-reference to #220)

- **Q18 (how the four accounts are created while registration is closed):** answered by section 2: the admin route and the host bootstrap command exist; no new script is needed. The #220 "Script gaps" row "Script that creates the student, teacher and parent smoke accounts" can be closed with "not needed, admin route".
- **Still a gap:** there is no script for this checklist; it is manual (15 minutes, like EN-6 in `docs/qa/full-testing-25oct.md:258`). `scripts/demo-smoke.sh` expects demo accounts and `DEMO_PASSWORD` (`docs/ops/go-live-bijak-spm.md:364-366`); it was not checked against these accounts and is not part of C2.
- **Not found in the repo:** an SPA screen for the forced password change (open question 3); an edge allow-list for the dark address (#220 Q15), which decides how QA reaches `<vps-url>` on 28 Oct.

## 7. What was not verified

- Nothing was run: no server, no browser, no API call, no test. All statements come from reading the files named above.
- Whether the SPA lets a flagged account reach `/profile` and change its password; what a parent sees if the production build has the scope off; whether the release SPA shows the one-time password; how `migrate:all` handles an e-mail collision; whether `GET /api/public/stats` and school lists count the smoke rows (they are v2 rows, so assume yes).
- The mail path for password reset in production (not needed by this plan).
