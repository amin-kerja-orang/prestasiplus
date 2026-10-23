# P11: production smoke accounts and smoke checklist

| | |
|---|---|
| **Status** | Draft (23 Oct 2026). Not run on any server. Rehearsed once end to end on a local stack on 23 Oct 2026 (section 8: evidence, the doc fixes made from it, and one go-live blocker, P11-B1). |
| **Purpose** | Define the four v2-born smoke accounts (student, teacher, parent, admin), how they are created while self-registration is closed, and the sign-in checklist for 28 Oct (baseline) and 30 Oct (C2, before and after the DNS switch; repeated daily in hypercare). |
| **Owner** | QA, half AZ (G5 owner, [cutover plan](../ops/v2-cutover-plan.md) section 2, QA row, line 49). |
| **Prepared by** | Half AM (Amin2, AM2-Dev1) as help to half AZ. Docs only: no code, no data, no server was touched. |
| **Cutover plan links** | Section 3 P11 (line 88); A5 step (3) (line 191); C2 (line 216); section 4.5 "Smoke checks (no sign-in as a real minor)" (lines 278-284); section 5 criterion 9 (line 421); section 6.1 trigger R4 (line 447); section 6.3 R-b (line 465); section 7 "Hypercare" (line 521). |
| **Related open PRs** | #220 (run sheets: `pre-night-28oct.md` Step 3 and Q18, `vps-dark-setup-26oct.md` Q18 and step 11); #221 (REG-CLOSE, the switch that closes self-registration). |
| **Read against** | `feature/v2-backend` at 515e440f. File:line references below are on that sha unless marked "#221 branch" (`ops/AZ-reg-close`). Frontend facts were cross-checked on `be/integration-frontend` (29d85187; the edit-user page refs of 3.1a on 3f85cba8). The re-flag lines of 3.1a are on 4d351826 (merged into this branch). The `/password/change` page is read on the head of PR #226 (7bc6295c), which is not on the tip. |
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
- **Forced password change.** An account made by an admin or by the bootstrap command carries `must_reset_password = true` (`users.service.ts:196,215`; `admin-bootstrap.ts:189`). Until it is cleared, every route except `GET /api/session`, `PUT /api/me/password` and logout answers 403 `PASSWORD_CHANGE_REQUIRED`, "Sila tukar kata laluan anda sebelum meneruskan." (`password-change.guard.ts`; `apps/api/src/common/errors/api-error.ts:13`). The SPA only types the flag (`src/stores/http-session.ts:39` on `be/integration-frontend`); it has no screen or handling for it (tracked as BUG AM2-A1 on #113, fix in progress). **Clear it on 28 Oct** (section 2.3 step 6). It also matters for the plan's SQL check "number of accounts marked for a forced password reset equals the expected number" (plan 4.5 part 1): four flagged smoke rows would add 4 to the figure. **Exception, on purpose:** RUN-30a (C2) sets the flag again for `<smoke-student>` only (section 3.1a), so that C2 exercises the first-login flow of plan 4.5 part 2; that adds 1 until the student has changed the password (SQL order in 3.1a).

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

1. **Bootstrap `<smoke-admin>`** (half AZ DevOps at the host shell, QA present; #220 `pre-night-28oct.md:4`: "The LEAD runs each step by hand on the production VPS (half AZ DevOps and QA may be present; QA does step 3). Every step that changes the server needs the LEAD's explicit go first." So the LEAD runs or approves this command). Use the form in #220 `vps-dark-setup-26oct.md` step 11, hidden prompt, `--mode=create`. The password is generated in the QA operator's password manager and entered at the prompt; it is never spoken, sent or put on a command line. Expected: two prompts ("New password (hidden):", "Repeat the new password:", nothing echoed), then exit 0 and a line "OK create: user id ... Audit row written." (`cli.ts`). Exit 3 means an active admin already exists ("Refused: an active Admin Pusat already exists. Use the admin user screen, or --mode=reset for a locked-out last admin."): STOP and ask the LEAD (do not use raw SQL or the demo seed). The hidden prompt needs a real terminal (a pty); `--password-stdin` needs a file or pipe. Both were run in the rehearsal (section 8.2).
2. **Sign in as `<smoke-admin>`** on `<vps-url>/login`. Clear the forced change (step 6 below).
3. **Create `<smoke-school>`** at `/admin/schools/create`: a clearly fictitious name and code, type SMK, a valid state, active. (One school only. Open question 6.)
4. **Create `<smoke-teacher>`** at `/admin/users/create`: role teacher, school `<smoke-school>`, e-mail from open question 8. Copy the one-time password straight into the password manager.
5. **Create `<smoke-student>`** (role student, grade 4, school `<smoke-school>`) and **`<smoke-parent>`** (role parent, no school, no linked pupil). Same copy rule. The one-time password panel reads "Maklumat log masuk pengguna — catat sekarang, ia tidak akan dipaparkan semula." with Nama, Emel and Kata laluan; a reload shows nothing. In the student form the school is picked by typing 2 or more characters of its name in "Cari nama sekolah..." and clicking the result, and the grade card is "Darjah 4" (grade 4 in an SMK school is odd but accepted; use a type SK school or grade 7 if that bothers the LEAD). *Check first (open question 4):* the SPA must show the one-time password after create. On `be/integration-frontend` it does (`src/modules/m02-users-schools/pages/UserCreatePage.vue:214-220`); on `feature/v2-backend` 515e440f the SPA code outside the mock does not reference `generatedPassword`, so a password created there would be lost. If the release SPA does not show it, create the three users through `POST /api/admin/users` with the admin session and CSRF token and store the response value directly in the password manager (not in a file, not in shell history). If a password was lost, an admin reset (`PUT /api/admin/users/:id` with `resetPassword: true`, `users.service.ts:226`) issues a new one.
6. **Clear the forced change on each account** (admin first, then teacher, student, parent): sign in once, then `PUT /api/me/password` with `currentPassword`, `password`, `passwordConfirmation` (`packages/contract/src/account/schema.ts:453-458`). It sets the flag false and rotates the session (`profile.service.ts:193-224`). **On `be/integration-frontend` the SPA has no screen for the flag** (it is typed only, `src/stores/http-session.ts:39`; BUG AM2-A1 on #113). **With the head of PR #226 plus the half-AZ guard patch v2 the SPA path works for all four roles** (rehearsal, section 8.3): signing in with the one-time password lands on `/password/change`; after the change the app goes to the role landing and shows a green flash "Kata laluan berjaya dikemaskini.". So on 28 Oct do this step in the SPA, and record it as the S1/S2, T1/T2, P1/P2 and A1/A2 rows of RUN-28 (same action: a separate sign-in for those rows would find the flag already 0, section 3.2 S2). Use the API call only if the release SPA lacks `/password/change` (then record the defect, open question 3). **The new password must differ from the one-time one:** the server currently accepts the same value, which would make the one-time password permanent (P11-B2, section 8.5). The public reset flow (`POST /api/auth/password/reset`, `password-reset.service.ts:134`) also clears the flag but needs working mail.
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

**How to use.** Copy this section into the cutover issue for each run and fill it as text. Run labels (not the plan's rollback triggers R1 to R6): **RUN-28** (28 Oct, step 3 baseline, after creation), **RUN-30a** (30 Oct morning, C2, before the DNS switch), **RUN-30b** (30 Oct, after the switch), **H-n** (hypercare, once a day to 6 Nov, plan line 521). Times are MYT. Order: global rows G, in RUN-30a the re-flag steps F1 to F5 of 3.1a, then one role at a time (student first); sign out between roles. Use a private browser window per role.

**STOP rule.** Any Fail in RUN-30a or RUN-30b is trigger **R4** (plan line 447): **no switch** (RUN-30a), or the LEAD decides a rollback inside the 4-hour window (RUN-30b, plan section 6.2). Do not retry to "make it pass": stop, record the step, time and (without secrets) what was seen, and tell the LEAD. In RUN-28 a Fail means the accounts are not ready: do not tell AZ to take `pre_etl`. A Fail in H-n goes to the LEAD at once.

### 3.1 Global (do once per run, before the roles)

| Step | Check | Expected | Pass/Fail | Time |
|---|---|---|---|---|
| G1 | `GET <vps-url>/api/health` | 200 (liveness, `docs/ops/api-runbook.md:75`) | | |
| G2 | `GET <vps-url>/api/ready` | 200 with `"status":"ready"`, `"db":"up"`, `"migrations":"applied"`; 503 is a Fail (`api-runbook.md:76`) | | |
| G3 | Open `<vps-url>/login` | Login page "Log Masuk - PRESTASIPLUS" (`LoginPage.vue` header comment), heading "Selamat Kembali! 👋", no 5xx in the network list. **Exactly one console entry and one 4xx are expected and are not a Fail:** "Failed to load resource: the server responded with a status of 401" for the anonymous `GET /api/session` that every cold load makes (seen on every public page at 375, 768 and 1280). Any other console error, or any 5xx, is a Fail. | | |
| G4 | (Information, AZ's probe, copy the result) `POST /api/auth/register` with an empty body, before the switch | 403 `REGISTRATION_CLOSED` while closed; 422 only after AZ reopens registration at the switch (`REGISTRATION_OPEN=true`, #221: `deploy/vps/api.env.example:24-25` on `ops/AZ-reg-close`). Not a QA Fail criterion. | | |
| G5 | (Information) Open `<vps-url>/register`, fill the form with a throw-away e-mail under a domain you control (student, any grade, password twice) and submit, before the switch | The page opens as a normal 3-step registration form (it does not say that registration is closed); after submit a red alert reads "Pendaftaran akaun baharu ditutup buat sementara waktu. Sila cuba lagi kemudian." (`POST /api/auth/register` answers 403), the URL stays `/register` and no user row is created. Same at 375, 768 and 1280. Not a QA Fail criterion (see P11-B3, section 8.5). | | |

### 3.1a RUN-30a only: re-flag `<smoke-student>` (before the student rows)

Plan 4.5 part 2 (line 283) wants the student to "start the first-login flow" at C2. The student was cleared on 28 Oct, so at C2 the flag is 0 and the path would not run. The smoke admin therefore resets the student's password with the **existing** admin action: `PUT /api/admin/users/:id` with `resetPassword: true` (`packages/contract/src/users/schema.ts:285-292`; service `apps/api/src/modules/users/users.service.ts:224-226,327`). The effect is exactly what a migrated, forced-reset pupil has: a new random one-time password returned once (`schema.ts:186-191`, `generatedPassword`), `mustChangePassword` true (`schema.ts:187`; `users.service.ts:327`) and all sessions of the target revoked (`users.service.ts:339-345`). Only `<smoke-student>` is re-flagged; teacher, parent and admin keep their 28 Oct passwords. Lines in this paragraph are on 4d351826.

| Step | Check | Expected | Pass/Fail | Time |
|---|---|---|---|---|
| F1 | Sign in as `<smoke-admin>` (this is also A1) | As A1 | | |
| F2 | Landing (this is also A3) | As A3 | | |
| F3 | Open `/admin/users`, find `<smoke-student>`, open its edit page `/admin/users/<id>/edit` | Tab title "Edit Pengguna - Admin Panel" (`src/modules/m02-users-schools/routes/user-form.ts:28-38` on `be/integration-frontend` 3f85cba8) | | |
| F4 | Open the password panel ("Tukar Kata Laluan" toggle), switch on "Janakan kata laluan baharu", save | The page stays and shows the one-time password once (`src/modules/m02-users-schools/pages/UserEditPage.vue:190-199` on `be/integration-frontend`). Hint copy: "Kata laluan rawak dijana oleh sistem dan dipaparkan sekali sahaja selepas disimpan." Copy the value straight into the password manager as the student's temporary password. If the release SPA lacks this panel, use `PUT /api/admin/users/:id` with the admin session and CSRF token (the body needs `roles` and `resetPassword: true`; `schema.ts:285-292`) and store the response value the same way. | | |
| F5 | Sign out the admin (A5 may be done in the same session first) | As S6 | | |

**SQL order.** The plan repeats the night SQL checks at C2, including "the number of accounts marked for a forced password reset" (plan 4.5 part 1). Take those counts **before F4**, or expect **+1** until S2 below has cleared the flag again. After S2 the count is back to the night figure.

### 3.2 Student `<smoke-student>`

| Step | Check | Expected | Pass/Fail | Time |
|---|---|---|---|---|
| S1 | Sign in with `<smoke-student>`. RUN-28: the password from the password manager (first sign-in after creation). **RUN-30a: the one-time password from F4.** RUN-30b and H-n: the new password set in S2 of RUN-30a, no re-flag. | No red alert (`LoginPage.vue`: success goes to the role landing with no message). Wrong credentials show the server text in a red alert and clear the password field: a Fail here. **RUN-28 and RUN-30a, with the forced-change page present:** the app goes to `/password/change` instead of the dashboard. | | |
| S2 | Forced change. **RUN-28 and RUN-30a only** (flag set); in RUN-30b and H-n the flag is 0 and this row is "not applicable". | `/password/change`: tab title "Tukar Kata Laluan - PRESTASIPLUS", heading "Tukar Kata Laluan", notice "Sila tukar kata laluan anda sebelum meneruskan." (`src/modules/m01-authentication/routes/password.ts:33-44` and `.../pages/PasswordChangeRequiredPage.vue:70,119` on #226 head 7bc6295c). Enter the one-time password as the current password, a new password from the password manager and its confirmation; the page calls `PUT /api/me/password` then `GET /api/session` and goes to the landing path. No 403 `PASSWORD_CHANGE_REQUIRED` afterwards. The new password replaces the one-time one in the password manager and **must differ from it** (the server accepts the same value, P11-B2). The landing page then shows a green flash "Kata laluan berjaya dikemaskini." (not an error banner). **RUN-28 order:** if the flag was already cleared in section 2.3 step 6, this row is "not applicable (done in step 6)"; the S2, T2, P2 and A2 rows were exercised at 375, 768 and 1280 in the rehearsal (section 8.3). **Dependency (plain):** `/password/change` exists only in PR #226 and, per the coordinator, needs the half-AZ guard patch to the shared router guard (shared files are half AZ's, `docs/plan/AGENT-SYNC.md:25`; what that patch is **Perlu pengesahan**). If #226 and the patch are not on the release sha, **this row cannot pass in RUN-30a and is a no-go item for the LEAD**; the same gap stops every migrated flagged pupil (BUG AM2-A1). Do not substitute the API call in RUN-30a: C2 exists to prove the screen. In RUN-28 the API call of section 2.3 step 6 is acceptable. | | |
| S3 | Landing | The server sends `/dashboard` (`session-view.ts:29-37`). Page `/dashboard`, tab title "Dashboard - PRESTASIPLUS", top-bar heading "Dashboard" (`src/modules/m05-practice/routes/dashboard.ts:10-18`). **The route meta subtitle "Selamat datang kembali" is not shown on the student dashboard** (only the parent "Belum tersedia" page shows it); the page instead opens with a hero card "Selamat <Pagi/Tengah Hari/Petang/Malam>, <name> 👋", "Jom teruskan latihan hari ini! 🚀" and the friend bubble (`HomeGreeting.vue`). Fail signs: the red banner "Maaf, berlaku ralat. Sila cuba semula." with a "Cuba Semula" button, or `GET /api/dashboard` answering 500. No 401/403/5xx. In RUN-30a this is the page reached after S2. **Known blocker P11-B1:** on a production-profile database (reference seed only, no wallet tier catalogue) this row fails with exactly that banner and a 500 until a tier row exists (section 8.5). | | |
| S4 | First-login flow (plan 4.5 part 2: "start the first-login flow"). Defined here as S1 to S3 including the forced password change (open question 9): in RUN-30a, one-time password, `/password/change`, new password, `/dashboard`. Do **not** start or submit a practice session. | S1 to S3 pass without a refresh loop, 403 or blank page | | |
| S5 | (Optional, read-only) open `/practice` | Tab title "Latih Tubi - PRESTASIPLUS". **On 28 Oct (before the `.cloud` load) there is no curriculum, so no subject list:** the page shows "Pilih subjek dan mula berlatih!" with one "Soalan by Chapter" card ("Mode Baru", "Mula"). The subject list appears only after the load (RUN-30a/b onward). Do not click "Mula" or "Mula Kuiz" (`docs/qa/uat-demo-23oct.md`, UAT-MUR-13/14) | | |
| S6 | Sign out: avatar button "Menu akaun" then "Log Keluar" (at 375/768 the admin layout needs the burger "Buka menu" first; the parent layout has a plain "Log Keluar" button on the page), or open `/logout` | Ends on `/login` with no message and no alert (`src/app/router/core-routes.ts:32-45`) | | |
| S7 | After sign-out, open `/dashboard` directly | Redirected to `/login` (route needs a session, `src/app/router/guards.ts:78-81`) | | |

### 3.3 Teacher `<smoke-teacher>`

| Step | Check | Expected | Pass/Fail | Time |
|---|---|---|---|---|
| T1 | Sign in | As S1. A refusal "inactive account" or "school inactive" means `<smoke-school>` or the account was deactivated: Fail. | | |
| T2 | Forced change (RUN-28 only; the flag stays 0 afterwards, no re-flag for this role) | As S2, RUN-28 variant (the API call of section 2.3 step 6 is acceptable) | | |
| T3 | Landing | The server sends `/dashboard`; the SPA moves a teacher to `/guru` (`guards.ts:96-101`, `prototype-scope.ts:276-277`). Tab title "Dashboard Guru - PRESTASIPLUS", header "Dashboard Guru" (`src/modules/m10-teacher-class/routes/dashboard.ts:12-21`). No error banner. | | |
| T4 | Sign out | As S6 | | |

### 3.4 Parent `<smoke-parent>`

| Step | Check | Expected | Pass/Fail | Time |
|---|---|---|---|---|
| P1 | Sign in | As S1. The API accepts the parent (`docs/qa/uat-demo-23oct.md`, UAT-IBU-01: role `parent`, landing `/dashboard`). | | |
| P2 | Forced change (RUN-28 only; the flag stays 0 afterwards, no re-flag for this role) | As S2, RUN-28 variant (the API call of section 2.3 step 6 is acceptable) | | |
| P3 | Landing | **With the default build (`VITE_PROTOTYPE_SCOPE=on`, `compose.yaml:21`, `docker/frontend/Dockerfile:21`; `compose.prod.yaml` does not override it):** parent is not a prototype role (`prototype-scope.ts:42`), so `/dashboard` is out of scope and the page shows tab title "Belum Tersedia dalam Prototaip | PRESTASIPLUS", heading "Belum tersedia dalam prototaip" and "Skrin ini belum termasuk dalam skop prototaip ini. Sila gunakan menu untuk melihat skrin yang tersedia." (`prototype-scope.ts:54-57`; known and by design, `docs/qa/demo-rehearsal-integrated-22oct.md` J-05). Plan 4.5 part 2 (line 283) requires each account to "sign in, reach their dashboard", and R4 (line 447) fails the run if a smoke account of any role cannot do that. So this page is **Pass only with a dated LEAD line** amending plan 4.5 part 2 to accept it for the parent (open question 5); until that line exists the parent row is **not Pass** (record "blocked by LEAD line"). If the release is built with the scope off: **Perlu pengesahan** what a parent sees. | | |
| P4 | Sign out | As S6 | | |

### 3.5 Admin `<smoke-admin>`

| Step | Check | Expected | Pass/Fail | Time |
|---|---|---|---|---|
| A1 | Sign in | As S1 | | |
| A2 | Forced change (RUN-28 only; the flag stays 0 afterwards, no re-flag for this role) | As S2, RUN-28 variant (the API call of section 2.3 step 6 is acceptable) | | |
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
| 3 | **High.** `mustChangePassword` is typed only in the SPA (`src/stores/http-session.ts:39` on `be/integration-frontend`); there is no screen or handling for it or for `PASSWORD_CHANGE_REQUIRED` (BUG AM2-A1 on #113, fix in progress as PR #226, `/password/change`, which also needs the half-AZ guard patch). Every admin-created account and every migrated forced-reset account is flagged. Is this a known gap, and who owns it? | Treat as a defect for the frontend owner to confirm on the dark deploy before 28 Oct. For RUN-28, QA may clear the flag by API (section 2.3 step 6). For RUN-30a the screen itself must work (section 3.1a, S2): if #226 and the patch are not on the release sha, that row fails and the LEAD treats it as a no-go item. If the SPA path fails for the smoke accounts it will fail for migrated pupils too (plan P10 tells them to set a new password), so record it as a go-live risk, not only a QA note. Rehearsal 23 Oct: with the #226 head plus patch v2 the screen works for all four roles (section 8.3). |
| 4 | Which frontend sha is the release? The one-time password panel exists on `be/integration-frontend` (`UserCreatePage.vue:214-220`) but not on `feature/v2-backend` 515e440f. | Confirm on the dark deploy that `/admin/users/create` shows the password once; else use the API fallback of step 5. |
| 5 | Parent is out of the prototype scope and the production build keeps `VITE_PROTOTYPE_SCOPE=on` by default. Will the LEAD write a dated line amending plan 4.5 part 2 (line 283: each account must "sign in, reach their dashboard"; R4, line 447) so that "Belum tersedia dalam prototaip" counts as Pass for the parent? Is the parent linked to the student? | Yes, ask for the line (sign-in is what P11 tests); until it exists the parent row is "Pass only with the LEAD line", not Pass. Not linked (no child data, no reference to a pupil row). If the scope is switched off for production, repeat P3 and re-decide. |
| 6 | One fictitious active `<smoke-school>` (SMK, valid state) holding the teacher and student? It will appear in the public school search (`GET /api/schools/search`, active schools only) and in admin lists. | Yes, one school, named so that nobody mistakes it. Deactivate at the end (section 4). |
| 7 | Keep or remove the accounts after cutover? | Keep through hypercare (to 6 Nov), then deactivate; delete only on the LEAD's word. They survive a restore of `pre_etl` taken after they were created and a Procedure B rollback. |
| 8 | Login e-mail for each account. | A team-owned mailbox alias per role on a domain the team controls, never a school or pupil domain, and never one that exists in `.cloud` (the e-mail is unique case-insensitively, `users.service.ts:180`; **Perlu pengesahan** for half AM: how `migrate:all` treats a `.cloud` user whose e-mail equals a v2-born one). Addresses stay in the password manager. |
| 9 | What is "the first-login flow" for the student in plan 4.5 part 2? | The forced password change plus landing on `/dashboard` (S1 to S3). So that C2 really runs it, RUN-30a first has the smoke admin reset `<smoke-student>`'s password (`PUT /api/admin/users/:id`, `resetPassword: true`, section 3.1a): one-time password, sign-in, `/password/change`, new password, `/dashboard`, sign out. RUN-28 clears all four accounts; RUN-30b and H-n use the new password with no re-flag. **Dependency:** PR #226 (`/password/change`) and the half-AZ guard patch must be on the release sha; otherwise the RUN-30a student forced-change row cannot pass and is a no-go item for the LEAD (the same gap blocks every migrated flagged pupil, BUG AM2-A1). No practice is started or submitted, so no v2-born practice, answer or mastery row appears (they could disturb the totals if the SQL checks of 4.5 part 1 are ever compared by entity totals; **Perlu pengesahan** with the AM operator). |
| 10 | Who signs in on 30 Oct and who may hold the passwords? | The QA operator (half AZ), alone, in the password manager; AZ sees the result line only. |
| 11 | Other docs that are wrong or stale (not changed here). | (a) `docs/ops/production-vps.md` section 4 step 11 (line 222) and finding F1 (line 612) say there is no bootstrap command; the code has one. (b) #220 `pre-night-28oct.md` Step 3 and "Script gaps" item 5 name self-registration for the three roles; with #221 it is closed. (c) #220 `vps-dark-setup-26oct.md` says no setting closes registration; #221 adds it. (d) `docs/ops/go-live-bijak-spm.md` section 4.2 (line 364) says production smoke accounts are "unverified / to be created"; this document supersedes that for P11. (e) The C2 row says "four v2-born smoke accounts" while the plan's SQL check counts forced-reset accounts: see section 1, last bullet. |

## 6. Script gaps (cross-reference to #220)

- **Q18 (how the four accounts are created while registration is closed):** answered by section 2: the admin route and the host bootstrap command exist; no new script is needed. The #220 "Script gaps" row "Script that creates the student, teacher and parent smoke accounts" can be closed with "not needed, admin route".
- **Still a gap:** there is no script for this checklist; it is manual (15 minutes, like EN-6 in `docs/qa/full-testing-25oct.md:258`). `scripts/demo-smoke.sh` expects demo accounts and `DEMO_PASSWORD` (`docs/ops/go-live-bijak-spm.md:364-366`); it was not checked against these accounts and is not part of C2.
- **Not found on the tip:** an SPA screen for the forced password change (open question 3); it is in open PR #226 and needs the half-AZ guard patch (patch v2, #226 comment 6361274392); an edge allow-list for the dark address (#220 Q15), which decides how QA reaches `<vps-url>` on 28 Oct.

## 7. What was not verified

- Sections 1 to 6 were written from reading files. Section 8 records one local rehearsal that ran sections 2.3, 3 (RUN-28 variant, RUN-30a, RUN-30b) and G1 to G5 against a local stack. Nothing was run on any server.
- Still not known: whether #226 and its half-AZ guard patch (patch v2, #226 comment 6361274392) are on the release sha (the rehearsal used the #226 head plus the patch in the working tree); whether the release SPA has the edit-user "Janakan kata laluan baharu" switch and the one-time password panel on create (both present on the #226 head, which contains `be/integration-frontend`); the exact copy of the `/password/change` fields beyond what section 8.3 recorded.
- Whether the SPA lets a flagged account reach `/profile` (moot: the flagged account is sent to `/password/change`); what a parent sees if the production build has the scope off; how `migrate:all` handles an e-mail collision; whether `GET /api/public/stats` and school lists count the smoke rows (they are v2 rows, so assume yes).
- The mail path for password reset in production (not needed by this plan).

## 8. Local rehearsal 23 Oct 2026 (evidence)

One end-to-end rehearsal of sections 2.3, 3 (RUN-28 variant, RUN-30a, RUN-30b) and G1 to G5 on a local stack, by QA (rehearsal only; nothing was run on a server, a cloud demo, prestasiplus.my or prestasiplus.cloud). Verdict for this document: **the procedure works, with one go-live blocker (P11-B1: the student dashboard fails on a production-profile database) and the doc fixes of 8.4.** Times are browser or command times on a loopback stack, not what a person will need; a person types and copies, so plan the 15 minutes of section 6 as written.

### 8.1 Stack and what was loaded

| Part | What was used |
|---|---|
| Shas | Backend `45008602` (`feature/v2-backend`, includes #221 REG-CLOSE). The tip has since moved to `ad46031b` (#227); its API source changes (strict request bodies, `registration.service.ts`, support/articles/notifications controllers) do not touch the wallet, seed, auth or users code paths reported below. SPA `3c693152` (head of PR #226, `fe/AM2-A1-forced-password-change`) plus the half-AZ guard patch v2 applied to the working tree only (never committed). This doc at `53eddf30` (#222). |
| Database | Throwaway PostgreSQL 16 on loopback. The 36 migrations were applied file by file with `psql` (Prisma's schema engine is not available offline) and the 36 rows of `_prisma_migrations` were then written by hand; without them `/api/ready` answers 503 (P2010), which is a local artefact: production uses `prisma migrate deploy`. |
| Loaded | Only the production path of runbook section 7: `npm run be:db:seed` with `NODE_ENV=production`, `ALLOW_DEMO_SEED=false`. Output: "seed: profile=poc, 3 module(s): core-school-packages, spm-subject-configs, core-marketplace-categories" and the warning that 22 demo modules were skipped. No demo seed, no ETL. Row counts before step 1: users 0, schools 0, audit_events 0, school_packages 4, tiers 0; `/api/subjects` empty. |
| API | The built bundle (`npm run be:build`, `node dist/main.js`) with `NODE_ENV=production`, `COOKIE_SECURE=true`, `TRUST_PROXY_HOPS=1`, `REGISTRATION_OPEN=false`, `ALLOW_DEMO_SEED=false`, `BIJAK_POC_QUESTIONS=false`, `AI_PROVIDER=mock`, `OCR_ENGINE=none`, `THROTTLE_GLOBAL_PER_MINUTE=3000`, an absolute `FILE_STORAGE_DIR`, random 64-hex `SESSION_SECRET` and `IC_HASH_KEY`. |
| Relaxed | No Docker, no nginx edge, no TLS (a small Node static server plus `/api` proxy on localhost stands in for the edge and adds no `X-Forwarded-*` header), no mail, no ClamAV, no metrics scraper, database user without password on loopback. The `Secure` session cookie is accepted by Chromium on `http://localhost`, so `COOKIE_SECURE=true` needed no relaxing. |
| SPA | `vite build --mode demo` with `VITE_API_MODE=http`, `VITE_TEST_HOOKS=false`, `VITE_PROTOTYPE_SCOPE=on`, empty `VITE_API_BASE_URL` (the build arguments of `deploy/vps/compose.prod.yaml:43-45` and `docker/frontend/Dockerfile:21`). The build succeeded (18.7 s), so no dev server was used. |
| Browser | Chromium 141 (installed build) driven by Playwright scripts, one private context per role per run, viewports 375x812, 768x1024, 1280x800. Passwords were random and held only in a tmpfs file of mode 600 (deleted at the end), never printed; accounts used e-mails under `.test`. |
| Fixture (not a doc step) | Section 2.3 step 6 clears the flag before the checklist, so the literal RUN-28 forced-change rows can no longer run afterwards. To exercise them at all three widths, one SQL `update` put the flag back on the four smoke rows before each width (`RUN-28F` below). |

### 8.2 Creation path (section 2.3), 1280 wide

| Step | Result | Time |
|---|---|---|
| G1 `GET /api/health` (through the local edge) | Pass: 200 `{"status":"ok","db":"up"}` | 5 ms |
| G2 `GET /api/ready` | Pass: 200 `"status":"ready","db":"up","migrations":"applied"` | 4 ms |
| G4 `POST /api/auth/register` `{}` | Pass: 403 `REGISTRATION_CLOSED`, "Pendaftaran akaun baharu ditutup buat sementara waktu. Sila cuba lagi kemudian." Reopened with `REGISTRATION_OPEN=true` and a recreated api: 422 `VALIDATION_ERROR` (name, email, grade, password required), as the doc says; closed again. | 3 ms / 19 ms |
| 1 `admin:bootstrap --mode=create` through the hidden prompt (real pty) | Pass: "New password (hidden):", "Repeat the new password:", then "OK create: user id 1 on database ... The password must be changed at the next login. Audit row written."; exit 0; the typed password was not echoed in the terminal output. Row: `must_reset_password` true, audit `admin.bootstrap.created` (actor role `host_cli`). | 1.7 s |
| 1b second `--mode=create` with `--password-stdin` | Pass (refusal): exit 3, "Refused: an active Admin Pusat already exists. Use the admin user screen, or --mode=reset for a locked-out last admin."; `--password=...` gives exit 2; `--confirm` different from `--email` gives "Refused: --confirm must repeat --email exactly."; user count stayed 4 | 1.2 s |
| 2 Sign in as `<smoke-admin>` | Pass: goes to `/password/change`, tab "Tukar Kata Laluan - PRESTASIPLUS"; change succeeds and lands on `/admin/command-center` | 0.26 s + 0.30 s |
| 3 Create `<smoke-school>` (SMK, state Johor) at `/admin/schools/create` | Pass: tab "Tambah Sekolah - Admin PRESTASIPLUS", "Simpan" returns to `/admin/schools`; row `schools` 1 | 1.6 s |
| 4 Create `<smoke-teacher>` (school picked by typing) | Pass: tab "Tambah Pengguna - Admin Panel", one-time panel "Maklumat log masuk pengguna — catat sekarang, ia tidak akan dipaparkan semula." with Nama, Emel, Kata laluan (14 characters) | 1.9 s |
| 5 Create `<smoke-student>` (Darjah 4, school picked) and `<smoke-parent>` | Pass: same panel for both | 1.7 s, 0.9 s |
| 6 Clear the forced change, teacher, student, parent (admin done in step 2) | Pass for all three through the SPA: each signs in, is sent to `/password/change`, changes the password and lands on `/guru`, `/dashboard`, `/dashboard` | 1.9 s, 1.8 s, 1.3 s |
| 7 Count | Pass: users 4, schools 1, `must_reset_password` 0 | n/a |

### 8.3 Checklist results (Pass or Fail as run; three widths each: 1280 / 768 / 375; browser ms)

**RUN-28F** (flag set before each width, all four roles; every row had no horizontal overflow and no 5xx other than the one in S3):

| Row | 1280 | 768 | 375 | Exact screen text or URL seen |
|---|---|---|---|---|
| G3 `/login` | Pass 880 | Pass 885 | Pass 874 | Tab "Log Masuk - PRESTASIPLUS", heading "Selamat Kembali! 👋"; console entry 401 for `GET /api/session` only |
| S1 student sign-in | Pass 1189 | Pass 995 | Pass 1058 | Lands on `/password/change` |
| S2 forced change | Pass 320 | Pass 341 | Pass 210 | Tab "Tukar Kata Laluan - PRESTASIPLUS"; heading "Tukar Kata Laluan"; notice "Sila tukar kata laluan anda sebelum meneruskan."; fields "Kata Laluan Semasa", "Kata Laluan Baharu" (placeholder "Minimum 6 aksara"), "Sahkan Kata Laluan Baharu"; buttons "Tukar Kata Laluan", "Log Keluar"; no 4xx before the change; goes to `/dashboard` |
| S3 landing | **Fail** | **Fail** | **Fail** | Tab "Dashboard - PRESTASIPLUS"; red banner "Maaf, berlaku ralat. Sila cuba semula." with "Cuba Semula"; `GET /api/dashboard` 500 (P11-B1) |
| S4 first-login flow | **Fail** | **Fail** | **Fail** | S1 and S2 pass, S3 fails, so S4 fails |
| S5 `/practice` | Pass 1047 | Pass 947 | Pass 964 | Tab "Latih Tubi - PRESTASIPLUS"; "Pilih subjek dan mula berlatih!" and one "Soalan by Chapter" card; no subject list (no curriculum yet) |
| S6 sign out | Pass 484 | Pass 473 | Pass 462 | "Menu akaun" then "Log Keluar"; `/login`, no alert |
| S7 `/dashboard` after sign-out | Pass 711 | Pass 753 | Pass 731 | Redirected to `/login` |
| T1 sign-in, T2 forced change | Pass 1005, 299 | Pass 996, 227 | Pass 1051, 247 | `/password/change`, then `/guru` |
| T3 landing | Pass 6 | Pass 5 | Pass 8 | `/guru`, tab "Dashboard Guru - PRESTASIPLUS", heading "Dashboard Guru"; at 768 and 375 "Mula Di Sini — 3 Langkah Mudah"; green flash "Kata laluan berjaya dikemaskini." |
| T4 sign out | Pass 434 | Pass 319 | Pass 362 | As S6 |
| P1 sign-in, P2 forced change | Pass 1200, 263 | Pass 1007, 216 | Pass 970, 208 | `/password/change`, then `/dashboard` |
| P3 landing | Pass 7 | Pass 6 | Pass 7 | Tab "Belum Tersedia dalam Prototaip \| PRESTASIPLUS"; "Belum tersedia dalam prototaip"; "Skrin ini belum termasuk dalam skop prototaip ini. Sila gunakan menu untuk melihat skrin yang tersedia." As the doc says, **Pass only with the LEAD line** (open question 5) |
| P4 sign out | Pass 156 | Pass 133 | Pass 109 | Plain "Log Keluar" button on the page |
| A1 sign-in, A2 forced change | Pass 1147, 282 | Pass 1043, 217 | Pass 1030, 213 | `/password/change`, then `/admin/command-center` |
| A3 landing | Pass 6 | Pass 7 | Pass 7 | Tab "PRESTASIPLUS COMMAND CENTER" |
| A4 `/admin/users` | Pass 993 | Pass 932 | Pass 987 | Tab "Pengurusan Pengguna - Admin Panel"; the four smoke rows listed (1 Pelajar, 1 Guru, 1 Ibu Bapa, 1 Admin counters) |
| A5 sign out | Pass 515 | Pass 1338 | Pass 1329 | 1280: "Menu akaun" then "Log Keluar"; 768 and 375: burger "Buka menu", "Menu akaun", "Log Keluar" (reachable) |

**RUN-30a** (section 3.1a; student re-flagged by the smoke admin, then the student's first login), all three widths: F1 Pass (1.3 to 1.5 s, lands `/admin/command-center`), F2 Pass, F3 Pass (tab "Edit Pengguna - Admin Panel", `/admin/users/3/edit`, 1.1 s), F4 Pass (password panel opens; the hint reads "Kata laluan rawak dijana oleh sistem dan dipaparkan sekali sahaja selepas disimpan."; the page stays on the edit URL and shows the one-time password, 14 characters; 0.29 to 0.39 s), F5 Pass (0.17 to 0.19 s, via `/logout`). Extra: a student session opened before F4 answers 401 after it (all sessions of the target revoked, as the doc says). SQL order: forced-reset count 0 before F4, 1 after F4, 0 after S2: as the doc says. S1 Pass (1.0 s, `/password/change`), S2 Pass (1.1 to 1.2 s, no overflow, goes to `/dashboard`), **S3 Fail and S4 Fail at 1280, 768 and 375 (P11-B1)**, S6 Pass, S7 Pass.

**RUN-30b** (student, new password, no re-flag), 1280 / 768 / 375: G3 Pass, S1 Pass (1406 / 1234 / 1280 ms, lands `/dashboard`, no alert), **S3 Fail** (P11-B1), S5 Pass, S6 Pass, S7 Pass.

**Diagnosis of S3 (not a doc step).** With one row inserted into `tiers` (bronze) the same student check passed at all three widths: tab "Dashboard - PRESTASIPLUS", hero "Selamat Malam, <name> 👋", "Jom teruskan latihan hari ini! 🚀", no 4xx or 5xx. The row was removed again.

**G5 / REG-CLOSE in the SPA**, three widths: `/register` opens as the full form (no closed notice); after submit the red alert "Pendaftaran akaun baharu ditutup buat sementara waktu. Sila cuba lagi kemudian." appears, the URL stays `/register`, `POST /api/auth/register` is 403, no user row was created (0 rows), no overflow.

**Responsive:** no horizontal page scroll and no clipped or overlapping content on any screen above at 375, 768 or 1280 (script check of `scrollWidth` against `clientWidth`, plus screenshots of the forced-change page at 375, the admin user list at 375 and the student dashboard at 1280).

### 8.4 Deviations between this document and reality, and the fixes made in this commit

| # | Where | Reality | Fix |
|---|---|---|---|
| 1 | Section 2.3 step 6 against RUN-28 rows S2, T2, P2, A2 | Contradiction: step 6 clears the flag and step 7 requires 0, yet S2/T2/P2/A2 say "flag set" in RUN-28. | Step 6 now says to do it in the SPA and record it as the S1/S2, T1/T2, P1/P2, A1/A2 rows; S2 says "not applicable (done in step 6)" if already cleared. |
| 2 | Section 2.3 step 6, "no screen" | With #226 head plus patch v2 the SPA screen works for all four roles. | Replaced the "Perlu pengesahan" text with the verified result; API call kept as the fallback. |
| 3 | Step 6 and S2: new password | The server accepts a new password equal to the one-time one (P11-B2). | Warning added: the new password must differ. |
| 4 | G3 "no console error" | One console entry (401 for the anonymous `GET /api/session`) appears on every cold load. | G3 rewritten to allow exactly that entry and fail on anything else. |
| 5 | S3 header and subtitle | The student dashboard shows no "Selamat datang kembali"; it shows the hero greeting. The route subtitle is shown only on the parent page. | S3 rewritten with the real text, the fail signs, and a pointer to P11-B1. |
| 6 | S2 landing | A green flash "Kata laluan berjaya dikemaskini." is shown after the change. | Added to S2. |
| 7 | S5 "lists subjects" | On 28 Oct there is no curriculum, so there is no subject list. | S5 rewritten. |
| 8 | S6 "Log Keluar" | It sits in the "Menu akaun" menu (behind "Buka menu" for the admin at 375 and 768); the parent layout has a plain button. | S6 rewritten. |
| 9 | Step 1 | Prompt texts and the exit 3 message were not quoted; the hidden prompt needs a pty. | Added. |
| 10 | Step 5 | Panel text, school picker and grade card were not described. | Added. |
| 11 | Section 3.1 | No row for REG-CLOSE in the SPA. | G5 added (information). |
| 12 | Status, section 7, question 3 | "Nothing was run". | Updated to point to this section. |

Left as written, for the LEAD: the student in an SMK school with grade 4 is accepted but odd (note added to step 5); the server error texts on the BM forms are English (P11-B4).

### 8.5 Defects found

| ID | Severity | What | Where | Owner |
|---|---|---|---|---|
| P11-B1 | **Critical** (go-live blocker; R4 no-go) | On a production-profile database every student gets a red error banner on `/dashboard`: `GET /api/dashboard` and `GET /api/gamification/wallet` answer 500 ("M14: no tier is defined"). The tier catalogue (`tiers` table) is created only by the demo-kind wallet seed, which production skips; the reference set (core-school-packages, spm-subject-configs, core-marketplace-categories) has no tier module, and the ETL does not load it (`gamification_tiers` is listed as not migrated, "BE-29 wave"). The wallet code falls back to the default tier of an empty list and throws, for any student, migrated or not. S3 and S4 fail in RUN-28, RUN-30a and RUN-30b at all three widths. One bronze row made S3 pass. | Throw: `apps/api/src/modules/wallet/wallet.service.ts:338` (also `apps/api/src/modules/gamification/gamification.service.ts:414`). Data: `apps/api/prisma/seed/wallet.ts:29` (`WALLET_TIERS`) and `:188-190` (`kind: 'demo'`); reference set `apps/api/prisma/seed/index.ts:71-82`; not migrated `apps/api/src/migration/load/index.ts:55`. An admin route to create tiers exists (`apps/api/src/modules/gamification/admin.controller.ts:36`), not exercised here. | Backend half (needs the LEAD's approval to add a reference module, `seed/index.ts:76-78`, or a decision to create tiers by hand before 28 Oct) |
| P11-B2 | Medium | `PUT /api/me/password` accepts a new password equal to the current one, so a forced-reset account can "clear" the flag with its one-time password (tested at 375: same value accepted, landed on `/dashboard`). | `apps/api/src/modules/account/profile.service.ts:193-224` (no comparison of `currentPassword` and `password`). A fix is on `origin/be/AM2-pw-change-differs` (d5ae845d), not on the tip tested. | Backend half (fix in flight) |
| P11-B3 | Low | While registration is closed `/register` still shows the whole 3-step form; the closed message appears only after submit, at all three widths. | `src/modules/m01-authentication/pages/RegisterPage.vue` (no read of the closed state before submit) | Frontend half, LEAD to decide whether to change it before go-live |
| P11-B4 | Low | Server texts on the BM change-password screen are English: "The password is incorrect.", "The password field confirmation does not match.", "The password field must be at least 6 characters." | `packages/contract/src/account/schema.ts` (message table, minimum 6 at line 147) | Contract owner |

### 8.6 Not run

Real Prisma `migrate deploy`, Docker, the nginx edge, TLS and HSTS in a browser, mail and password reset, `migrate:all` and the ETL (so the post-load RUN-30a/30b with migrated data and subjects), the admin tier route as a workaround for P11-B1, the 20-failed-logins throttle, a wrong-password sign-in text, the unit and integration suites, and the existing e2e suites. A browser tool server was not available to the session, so all browser steps ran as Playwright scripts.
