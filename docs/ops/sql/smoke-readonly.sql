-- =====================================================================================================================
-- smoke-readonly.sql: read-only SQL checks of the cutover plan, section 4.5 part 1 (night, B8) and part 2 (C2 repeat);
-- go/no-go criterion 9. Deliverable P-9 of the A4 run sheet (rehearsal-a4-27oct-timing.md); run as T17 and at B8.
--
-- WHAT IT IS
--   One transaction, BEGIN TRANSACTION READ ONLY ... ROLLBACK, holding ONE SELECT. Postgres refuses any write inside
--   a READ ONLY transaction, so the file fails closed. No DDL, no DML, no temp table, no side-effect function (the
--   only function that runs SQL text is query_to_xml(), and only on SELECT text that is fixed in this file).
--   The advisory-lock row reads pg_locks; it never takes the lock.
--
-- OUTPUT (aggregates only, safe to paste as text; PDPA: no minor's data leaves the database)
--   One row per check: check_id | description | value | expected | ok
--     ok = 'ok'    the machine check passed
--          'FAIL'  the machine check failed: STOP at night (plan 4.6 B8, trigger R4 at C2)
--          'info'  no machine rule: the operator compares `value` with the text in `expected` (usually the verify
--                  report) and writes the result next to the row. 'info' never means "pass".
--   Rows are sorted by check_id within block (A run ledger, B sample users, C wallets, D geography, E entity counts,
--   F forced reset, S soft reference, U usernames, X rejects, Z total). The last row, Z0, counts the FAIL rows. The file never prints a name, e-mail, IC, username, phone, free text,
--   hash or any id of a person. The "sample" users of block B are chosen by surrogate id (users.id % 50 = 0) and are
--   only counted. Source: 'cloud' (the only source migrated at night).
--
-- HOW TO RUN (psql 16; the file has no psql meta-commands, so both forms work)
--   Table form, on a restored COPY or on the target (no password in argv; the URL stays in the environment):
--     PGOPTIONS='-c statement_timeout=120000' psql -X -v ON_ERROR_STOP=1 -f docs/ops/sql/smoke-readonly.sql
--   Through the `q` helper of the A1 sheet (only the SQL text is in argv; do not paste the text inside double quotes,
--   the dollar-quote tags would be expanded by the shell; command substitution is safe):
--     q "$(cat docs/ops/sql/smoke-readonly.sql)"
--   `q` prints rows with `|` between columns and no header (psql -At).
--   Time (A4 dress run, local PostgreSQL 16, synthetic data): 0.1 s on an empty migrated DB, 1.4 s on the medium
--   fixture (366k staged rows), about 10 s on a copy inflated to about 9 million rows (counts on indexed legacy
--   columns, one hash aggregate over coin_ledger, one pass over the staged sessions and answers; no cross join).
--   Set statement_timeout as above so that a slow run stops instead of waiting.
--
-- PERSISTED CORE COUNTERS (rows F3 to F5, F8 to F10)
--   They compare staged-side counts with the `note ...` counters of the core stage. A build that persists them in
--   etl_runs.counters -> 'notes' of the latest succeeded core apply run gives ok / FAIL. A build that does not
--   persist them gives 'info' (expected = "compare with the B7 output"; the operator compares by hand). When the notes
--   say countsFromCommittedRows = 1 (a resumed apply: non_bcrypt and shared_default only saw the resumed part; the
--   roster count is rebuilt from the committed rows and stays exact) F4 and F5 are 'info' too.
--
-- STAGING-DEPENDENT CHECKS (blocks B, D1/D2 and F3 to F7)
--   They read staging_cloud (kept in the target from the stage copy B5 until migrate:archive-minimise). When
--   staging_cloud.* is absent (an empty migrated DB, or after minimise) the row says ok = 'info' and value 'n/a:
--   staging_cloud not present' instead of failing.
--
-- MAP TO THE PLAN (docs/ops/v2-cutover-plan.md)
--   4.5 part 1, "per role sample: migrated practice-session and answer counts equal the staged counts" -> B1.*, B2.*
--   4.5 part 1, "sample of wallets: balance against the ledger sum equals what the verify report lists" -> C1 to C3
--   4.5 part 1, "derived JPN/PPD rows equal the distinct state and district pairs"                       -> D1, D2
--   4.5 part 1, "accounts marked for forced reset equal the expected number"                             -> F1 to F10
--   4.6 B8 "SQL counts equal the verify report"; "entity counts, reject counts by reason"               -> E.0, E.*, X1.*
--   Criterion 9 (B8 part), R4 (a check differs from the verify report)                                  -> all rows
--   Criterion 2 / 3 evidence (reject thresholds, ORPHAN_PARENT on users and schools)                      -> X1 to X3
--   Not SQL, so not here: health and ready endpoints; sign-in of the v2-born smoke accounts (part 2);
--   the freeze proof max(updated_at) <= T-freeze (B4, criterion 13: half AZ gives the one-line form).
--   Rows marked "(added, not in plan)" are cheap integrity checks that the plan does not list.
-- =====================================================================================================================

BEGIN TRANSACTION READ ONLY;

WITH
-- Latest succeeded apply run per entity, exactly as migrate:verify picks it (verify/index.ts, latestRecon).
recon AS (
  SELECT DISTINCT ON (c.entity) c.entity, c.run_id, c.source_count, c.loaded, c.rejected
  FROM etl_recon c JOIN etl_runs r ON r.id = c.run_id
  WHERE 'cloud' = ANY (r.sources) AND r.mode = 'apply' AND r.status = 'succeeded'
  ORDER BY c.entity, c.run_id DESC
),
-- Live rows of each v2 table keyed to the legacy source (the entity list of verify/entities.ts; 37 entities).
live AS (
    SELECT 'education_levels' AS entity, count(*) AS n FROM education_levels WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'subjects' AS entity, count(*) AS n FROM subjects WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'chapters' AS entity, count(*) AS n FROM chapters WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'topics' AS entity, count(*) AS n FROM topics WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'subject_levels' AS entity, count(*) AS n FROM subject_levels WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'jpns' AS entity, count(*) AS n FROM jpns WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'ppds' AS entity, count(*) AS n FROM ppds WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'schools' AS entity, count(*) AS n FROM schools WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'users' AS entity, count(*) AS n FROM users WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'parent_links' AS entity, count(*) AS n FROM parent_links WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'classrooms' AS entity, count(*) AS n FROM classrooms WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'enrolments' AS entity, count(*) AS n FROM enrolments WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'school_subscriptions' AS entity, count(*) AS n FROM school_subscriptions WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'tiers' AS entity, count(*) AS n FROM tiers WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'achievements' AS entity, count(*) AS n FROM achievements WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'challenges' AS entity, count(*) AS n FROM challenges WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'gamification_settings' AS entity, count(*) AS n FROM gamification_settings WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'wallets' AS entity, count(*) AS n FROM wallets WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'coin_ledger' AS entity, count(*) AS n FROM coin_ledger WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'practice_sessions' AS entity, count(*) AS n FROM practice_sessions WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'practice_answers' AS entity, count(*) AS n FROM practice_answers WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'streaks' AS entity, count(*) AS n FROM streaks WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'exam_attempts' AS entity, count(*) AS n FROM exam_attempts WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'challenge_completions' AS entity, count(*) AS n FROM challenge_completions WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'user_achievements' AS entity, count(*) AS n FROM user_achievements WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'referral_codes' AS entity, count(*) AS n FROM referral_codes WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'referrals' AS entity, count(*) AS n FROM referrals WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'spm_targets' AS entity, count(*) AS n FROM spm_targets WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'articles' AS entity, count(*) AS n FROM articles WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'banners' AS entity, count(*) AS n FROM banners WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'notes' AS entity, count(*) AS n FROM notes WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'videos' AS entity, count(*) AS n FROM videos WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'audio_kbat_sets' AS entity, count(*) AS n FROM audio_kbat_sets WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'question_sets' AS entity, count(*) AS n FROM question_sets WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'support_tickets' AS entity, count(*) AS n FROM support_tickets WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'timeline_posts' AS entity, count(*) AS n FROM timeline_posts WHERE legacy_source = 'cloud'
    UNION ALL SELECT 'feedback' AS entity, count(*) AS n FROM feedback WHERE legacy_source = 'cloud'
),
-- Which staged tables exist now (staging_cloud is a plain schema in the target after the stage copy).
stg AS (
  SELECT to_regclass('staging_cloud.practice_sessions') IS NOT NULL AND to_regclass('staging_cloud.question_attempts') IS NOT NULL AS has_activity,
         to_regclass('staging_cloud.schools') IS NOT NULL AS has_schools,
         to_regclass('staging_cloud.users') IS NOT NULL AS has_users
),
-- Block B, staged side. One XML table per role: sample users (users.id % 50 = 0) with their v2 and staged counts.
-- A staged row that has no v2 row is allowed only when etl_rejects lists it ("explained"); the sums are counts.
b_xml AS (
  SELECT CASE WHEN (SELECT has_activity FROM stg) THEN query_to_xml($q$
    WITH s AS (
      SELECT r.role, x.id, x.legacy_id
      FROM users x JOIN user_roles r ON r.user_id = x.id
      WHERE x.legacy_source = 'cloud' AND x.id % 50 = 0
    ),
    u AS (SELECT role, count(*) AS users FROM s GROUP BY role),
    v2s AS (SELECT s.role, count(*) AS n FROM s JOIN practice_sessions p ON p.user_id = s.id AND p.legacy_source = 'cloud' GROUP BY 1),
    v2a AS (SELECT s.role, count(*) AS n FROM s JOIN practice_answers a ON a.user_id = s.id AND a.legacy_source = 'cloud' GROUP BY 1),
    sts AS (
      SELECT s.role, count(*) AS n,
             count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM practice_sessions p WHERE p.legacy_source = 'cloud' AND p.legacy_id = g.id::text)
                                AND EXISTS (SELECT 1 FROM etl_rejects j WHERE j.entity = 'practice_sessions' AND j.legacy_id = g.id::text)) AS rej
      FROM s JOIN staging_cloud.practice_sessions g ON g.user_id::text = s.legacy_id GROUP BY 1
    ),
    sta AS (
      SELECT s.role, count(*) AS n,
             count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM practice_answers a WHERE a.legacy_source = 'cloud' AND a.legacy_id = g.id::text)
                                AND EXISTS (SELECT 1 FROM etl_rejects j WHERE j.entity = 'practice_answers' AND j.legacy_id = g.id::text)) AS rej
      FROM s JOIN staging_cloud.question_attempts g ON g.user_id::text = s.legacy_id GROUP BY 1
    )
    SELECT u.role, u.users,
           coalesce(v2s.n, 0) AS v2_sessions, coalesce(sts.n, 0) AS st_sessions, coalesce(sts.rej, 0) AS rej_sessions,
           coalesce(v2a.n, 0) AS v2_answers, coalesce(sta.n, 0) AS st_answers, coalesce(sta.rej, 0) AS rej_answers
    FROM u LEFT JOIN v2s USING (role) LEFT JOIN v2a USING (role) LEFT JOIN sts USING (role) LEFT JOIN sta USING (role)
  $q$, false, false, '') END AS x
),
b AS (
  SELECT r.role,
         coalesce((xpath('/row/users/text()', e))[1]::text::bigint, 0) AS users,
         coalesce((xpath('/row/v2_sessions/text()', e))[1]::text::bigint, 0) AS v2_sessions,
         coalesce((xpath('/row/st_sessions/text()', e))[1]::text::bigint, 0) AS st_sessions,
         coalesce((xpath('/row/rej_sessions/text()', e))[1]::text::bigint, 0) AS rej_sessions,
         coalesce((xpath('/row/v2_answers/text()', e))[1]::text::bigint, 0) AS v2_answers,
         coalesce((xpath('/row/st_answers/text()', e))[1]::text::bigint, 0) AS st_answers,
         coalesce((xpath('/row/rej_answers/text()', e))[1]::text::bigint, 0) AS rej_answers
  FROM unnest(ARRAY['admin','school_admin','ppd_officer','teacher','student','parent','sponsor']) AS r(role)
  LEFT JOIN LATERAL (
    SELECT e FROM unnest(xpath('/table/row', (SELECT x FROM b_xml))) AS e
    WHERE (xpath('/row/role/text()', e))[1]::text = r.role
  ) m ON true
),
-- Block D, staged side: distinct state and (state, district) pairs of staging_cloud.schools, normalised like
-- CoreContext.geo / buildGeo (trim, squash spaces, upper case; a school without a state gives no JPN or PPD).
d_xml AS (
  SELECT CASE WHEN (SELECT has_schools FROM stg) THEN query_to_xml($q$
    SELECT count(DISTINCT st) AS jpns, count(DISTINCT st || '|' || di) FILTER (WHERE di IS NOT NULL) AS ppds
    FROM (SELECT upper(nullif(btrim(regexp_replace(state, '\s+', ' ', 'g')), '')) AS st,
                 upper(nullif(btrim(regexp_replace(district, '\s+', ' ', 'g')), '')) AS di
          FROM staging_cloud.schools) t
    WHERE st IS NOT NULL
  $q$, false, true, '') END AS x
),
d AS (
  SELECT (xpath('/row/jpns/text()', (SELECT x FROM d_xml)))[1]::text::bigint AS st_jpns,
         (xpath('/row/ppds/text()', (SELECT x FROM d_xml)))[1]::text::bigint AS st_ppds
),
-- Block C: wallet balance against the sum of the user's migrated ledger rows (verify/checks.ts, ledger()).
c AS (
  SELECT count(l.user_id) AS with_ledger,
         count(l.user_id) FILTER (WHERE w.current_syiling <> l.s) AS differing,
         count(*) FILTER (WHERE l.user_id IS NULL) AS without_ledger
  FROM wallets w
  LEFT JOIN (SELECT user_id, sum(amount) AS s FROM coin_ledger WHERE legacy_source = 'cloud' GROUP BY user_id) l ON l.user_id = w.user_id
  WHERE w.legacy_source = 'cloud'
),
-- Block F: forced password reset. F1/F2 use the predicate of A1.11 (e) unchanged.
u AS (
  SELECT count(*) FILTER (WHERE must_reset_password) AS flagged,
         count(*) AS migrated,
         count(*) FILTER (WHERE password_hash IS NULL) AS null_hash,
         -- Same predicate as Q10's recount of flaggedWithoutLoginId (plain IS NULL on the stored columns: the loader stores a
         -- blank username or e-mail as NULL, so this equals the counter by construction).
         count(*) FILTER (WHERE must_reset_password AND username IS NULL AND email IS NULL) AS no_login_id
  FROM public.users WHERE legacy_source = 'cloud'
),
-- Block F, staged side (rules of transform/users.ts and transform/secrets.ts, read from the staged row so that an
-- account whose duplicate e-mail was dropped AFTER the password decision is not mistaken for a roster account):
--   roster      username present and no valid e-mail in the staged row;
--   non_bcrypt  staged hash is not bcrypt $2a/b/x/y$ cost 04..13 (argon2id, plain text, empty, NULL);
--   null_expected  non_bcrypt that is not argon2id: the loader stores a NULL hash.
f_xml AS (
  SELECT CASE WHEN (SELECT has_users FROM stg) THEN query_to_xml($q$
    WITH j AS (
      SELECT x.must_reset_password AS flagged,
             (x.password_hash IS NULL) AS v2_null_hash,
             (nullif(btrim(s.username, E' \t\r\n\f\v'), '') IS NOT NULL
              AND (nullif(lower(btrim(s.email, E' \t\r\n\f\v')), '') IS NULL
                   OR lower(btrim(s.email, E' \t\r\n\f\v')) !~ '^[^\s@]+@[^\s@]+$')) AS roster,
             (coalesce(btrim(s.password, E' \t\r\n\f\v'), '') !~ '^\$2[abxy]\$(0[4-9]|1[0-3])\$[./A-Za-z0-9]{53}$') AS non_bcrypt,
             (coalesce(btrim(s.password, E' \t\r\n\f\v'), '')
                ~ '^\$argon2id\$v=\d+\$m=\d+,t=\d+,p=\d+\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$') AS argon2
      FROM users x JOIN staging_cloud.users s ON s.id::text = x.legacy_id
      WHERE x.legacy_source = 'cloud'
    )
    SELECT count(*) AS migrated,
           count(*) FILTER (WHERE roster) AS roster,
           count(*) FILTER (WHERE non_bcrypt) AS non_bcrypt,
           count(*) FILTER (WHERE non_bcrypt AND NOT argon2) AS null_expected,
           count(*) FILTER (WHERE v2_null_hash) AS null_v2,
           count(*) FILTER (WHERE (roster OR non_bcrypt) AND NOT flagged) AS derivable_not_flagged,
           count(*) FILTER (WHERE flagged AND NOT roster AND NOT non_bcrypt) AS remainder
    FROM j
  $q$, false, true, '') END AS x
),
fs AS (
  SELECT (SELECT has_users FROM stg) AS has_f,
         (xpath('/row/migrated/text()', (SELECT x FROM f_xml)))[1]::text::bigint AS migrated,
         (xpath('/row/roster/text()', (SELECT x FROM f_xml)))[1]::text::bigint AS roster,
         (xpath('/row/non_bcrypt/text()', (SELECT x FROM f_xml)))[1]::text::bigint AS non_bcrypt,
         (xpath('/row/null_expected/text()', (SELECT x FROM f_xml)))[1]::text::bigint AS null_expected,
         (xpath('/row/null_v2/text()', (SELECT x FROM f_xml)))[1]::text::bigint AS null_v2,
         (xpath('/row/derivable_not_flagged/text()', (SELECT x FROM f_xml)))[1]::text::bigint AS derivable,
         (xpath('/row/remainder/text()', (SELECT x FROM f_xml)))[1]::text::bigint AS remainder
),
-- Block F, persisted counters of the core stage: etl_runs.counters -> 'notes' of the LATEST succeeded core apply run
-- (core = entity set holds users and classrooms, as orchestrate.ts recognises it). The run is picked first; only then
-- is it tested for notes, so a newer run without notes is never replaced by an older run's notes. A build or a run
-- that has no notes object gives has_notes = false and the notes rows turn into 'info' (compare with the B7 output).
-- A must_reset.* key that is absent while the notes exist means 0 (the loader counts a reason only when it happens).
-- A note value that is not a plain integer counts as absent for its row (that row is 'info'; the file never aborts).
core_notes AS (
  SELECT CASE WHEN jsonb_typeof(counters -> 'notes') = 'object' THEN counters -> 'notes' END AS n
  FROM etl_runs
  WHERE mode = 'apply' AND status = 'succeeded' AND 'cloud' = ANY (sources) AND entity_set @> ARRAY['users', 'classrooms']
  ORDER BY id DESC LIMIT 1
),
kv AS (
  SELECT e.key AS k, e.value AS v, (e.value ~ '^-?[0-9]{1,15}$') AS isnum
  FROM core_notes, jsonb_each_text(coalesce(core_notes.n, '{}'::jsonb)) e
),
nt AS (
  SELECT coalesce((SELECT n IS NOT NULL FROM core_notes), false) AS has_notes,
         -- countsFromCommittedRows = 1 means partial; an unreadable value is treated as partial (the safe side: 'info')
         coalesce((SELECT CASE WHEN isnum THEN v::bigint = 1 ELSE true END FROM kv WHERE k = 'countsFromCommittedRows'), false) AS partial,
         -- roster / non_bcrypt / shared: usable when the notes exist and the key is absent (= 0) or a plain integer
         coalesce((SELECT v::bigint FROM kv WHERE k = 'must_reset.roster_account' AND isnum), 0) AS roster,
         (coalesce((SELECT n IS NOT NULL FROM core_notes), false) AND NOT EXISTS (SELECT 1 FROM kv WHERE k = 'must_reset.roster_account' AND NOT isnum)) AS has_roster,
         coalesce((SELECT v::bigint FROM kv WHERE k = 'must_reset.non_bcrypt' AND isnum), 0) AS non_bcrypt,
         (coalesce((SELECT n IS NOT NULL FROM core_notes), false) AND NOT EXISTS (SELECT 1 FROM kv WHERE k = 'must_reset.non_bcrypt' AND NOT isnum)) AS has_non_bcrypt,
         coalesce((SELECT v::bigint FROM kv WHERE k = 'must_reset.shared_default' AND isnum), 0) AS shared,
         (coalesce((SELECT n IS NOT NULL FROM core_notes), false) AND NOT EXISTS (SELECT 1 FROM kv WHERE k = 'must_reset.shared_default' AND NOT isnum)) AS has_shared,
         -- the next three need the key to be present and a plain integer
         EXISTS (SELECT 1 FROM kv WHERE k = 'nullHashAccounts' AND isnum) AS has_null,
         (SELECT v::bigint FROM kv WHERE k = 'nullHashAccounts' AND isnum) AS null_hash,
         EXISTS (SELECT 1 FROM kv WHERE k = 'flaggedWithoutLoginId' AND isnum) AS has_nologin,
         (SELECT v::bigint FROM kv WHERE k = 'flaggedWithoutLoginId' AND isnum) AS no_login,
         EXISTS (SELECT 1 FROM kv WHERE k = 'rosterDefaultHashesWarning' AND isnum) AS has_warn,
         (SELECT v::bigint FROM kv WHERE k = 'rosterDefaultHashesWarning' AND isnum) AS warn,
         (SELECT v::bigint FROM kv WHERE k = 'rosterDefaultHashes' AND isnum) AS hashes
),
-- Block U (#226 F1): one lower-case username used by more than one account; same presence test as A1.11 (f).
uname AS (
  SELECT count(*) AS dup_names, coalesce(sum(n), 0) AS accounts
  FROM (SELECT count(*) AS n FROM users WHERE legacy_source = 'cloud' AND nullif(btrim(username), '') IS NOT NULL GROUP BY lower(username) HAVING count(*) > 1) t
),
-- Block X: rejects of the run that produced each entity's latest recon row (a dry-run or an earlier apply is not counted twice).
rej AS (
  SELECT j.reason, j.entity, count(*) AS n
  FROM etl_rejects j JOIN recon ON recon.run_id = j.run_id AND recon.entity = j.entity
  GROUP BY j.reason, j.entity
),
-- Run ledger.
runs AS (
  SELECT count(*) FILTER (WHERE mode = 'apply' AND status = 'succeeded') AS ok_apply,
         count(*) FILTER (WHERE mode = 'apply' AND status = 'succeeded' AND nullif(btrim(git_sha), '') IS NULL) AS ok_apply_no_sha,
         count(*) FILTER (WHERE status = 'running') AS running,
         count(*) FILTER (WHERE status = 'failed') AS failed,
         max(id) FILTER (WHERE mode = 'apply') AS last_apply
  FROM etl_runs WHERE 'cloud' = ANY (sources)
),
checks AS (
  -- ---------------------------------------------------------------- A. run ledger (added, not in plan)
  SELECT 'A' AS grp, 'A1' AS check_id, 'succeeded apply runs of source cloud (added, not in plan)' AS description,
         ok_apply::text AS value, '>= 1' AS expected, CASE WHEN ok_apply >= 1 THEN 'ok' ELSE 'FAIL' END AS ok FROM runs
  UNION ALL SELECT 'A', 'A2', 'status of the latest apply run (added, not in plan)',
         coalesce((SELECT status FROM etl_runs WHERE id = runs.last_apply), 'none'), 'succeeded',
         CASE WHEN (SELECT status FROM etl_runs WHERE id = runs.last_apply) = 'succeeded' THEN 'ok' ELSE 'FAIL' END FROM runs
  UNION ALL SELECT 'A', 'A3', 'succeeded apply runs with an empty git_sha (added, not in plan)',
         ok_apply_no_sha::text, '0', CASE WHEN ok_apply_no_sha = 0 THEN 'ok' ELSE 'FAIL' END FROM runs
  UNION ALL SELECT 'A', 'A4', 'short git_sha of the latest apply run (added, not in plan)',
         coalesce((SELECT left(git_sha, 8) FROM etl_runs WHERE id = runs.last_apply), 'none'), '= release sha (operator compares)', 'info' FROM runs
  UNION ALL SELECT 'A', 'A5', 'runs still in status running = open run lock (added, not in plan)',
         running::text, '0', CASE WHEN running = 0 THEN 'ok' ELSE 'FAIL' END FROM runs
  UNION ALL SELECT 'A', 'A6', 'sessions holding advisory lock etl:source:cloud (added, not in plan)',
         (SELECT count(*) FROM pg_locks l, (SELECT hashtextextended('etl:source:cloud', 0) AS k) h
           WHERE l.locktype = 'advisory' AND l.objsubid = 1
             AND l.classid = ((h.k >> 32) & 4294967295)::oid AND l.objid = (h.k & 4294967295)::oid)::text, '0',
         CASE WHEN (SELECT count(*) FROM pg_locks l, (SELECT hashtextextended('etl:source:cloud', 0) AS k) h
           WHERE l.locktype = 'advisory' AND l.objsubid = 1
             AND l.classid = ((h.k >> 32) & 4294967295)::oid AND l.objid = (h.k & 4294967295)::oid) = 0 THEN 'ok' ELSE 'FAIL' END
  UNION ALL SELECT 'A', 'A7', 'failed runs of source cloud, dry-runs included (added, not in plan)', failed::text, 'reported', 'info' FROM runs
  UNION ALL SELECT 'A', 'A8', 'applied schema migrations (added, not in plan)',
         (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)::text,
         '= ls -d apps/api/prisma/migrations/*/ | wc -l at the release sha (B0, criterion 8)', 'info'
  UNION ALL SELECT 'A', 'A9', 'schema migrations started but not finished or rolled back (added, not in plan)',
         (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL)::text, '0',
         CASE WHEN (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL) = 0 THEN 'ok' ELSE 'FAIL' END

  -- ---------------------------------------------------------------- B. plan 4.5 part 1, sample of users per role
  UNION ALL SELECT 'B', 'B1.' || role, 'sessions of ' || users || ' sample users, v2 against staged minus listed rejects (plan 4.5 part 1)',
         CASE WHEN (SELECT has_activity FROM stg) THEN v2_sessions::text ELSE 'n/a: staging_cloud not present' END,
         CASE WHEN (SELECT has_activity FROM stg) THEN (st_sessions - rej_sessions)::text || ' (staged ' || st_sessions || ', rejected ' || rej_sessions || ')' ELSE 'n/a' END,
         CASE WHEN NOT (SELECT has_activity FROM stg) THEN 'info' WHEN v2_sessions = st_sessions - rej_sessions THEN 'ok' ELSE 'FAIL' END FROM b
  UNION ALL SELECT 'B', 'B2.' || role, 'answers of the same sample users, v2 against staged minus listed rejects (plan 4.5 part 1)',
         CASE WHEN (SELECT has_activity FROM stg) THEN v2_answers::text ELSE 'n/a: staging_cloud not present' END,
         CASE WHEN (SELECT has_activity FROM stg) THEN (st_answers - rej_answers)::text || ' (staged ' || st_answers || ', rejected ' || rej_answers || ')' ELSE 'n/a' END,
         CASE WHEN NOT (SELECT has_activity FROM stg) THEN 'info' WHEN v2_answers = st_answers - rej_answers THEN 'ok' ELSE 'FAIL' END FROM b

  -- ---------------------------------------------------------------- C. plan 4.5 part 1, wallets against the ledger (all wallets, not a sample)
  UNION ALL SELECT 'C', 'C1', 'wallets whose balance differs from the ledger sum (plan 4.5 part 1)',
         differing::text, '= actual of verify line "wallet balance versus ledger sum (users with a difference)" (not stored in the DB)', 'info' FROM c
  UNION ALL SELECT 'C', 'C2', 'wallets that have migrated ledger rows (plan 4.5 part 1)', with_ledger::text, '= detail of the same verify line (not stored in the DB)', 'info' FROM c
  UNION ALL SELECT 'C', 'C3', 'wallets without ledger rows (plan 4.5 part 1)', without_ledger::text, '= detail of the same verify line (not stored in the DB)', 'info' FROM c

  -- ---------------------------------------------------------------- D. plan 4.5 part 1, derived JPN / PPD; PPD scope (#199)
  UNION ALL SELECT 'D', 'D1', 'JPN rows + rejects against distinct states of staging_cloud.schools (plan 4.5 part 1)',
         CASE WHEN (SELECT has_schools FROM stg) THEN (SELECT count(*) FROM jpns WHERE legacy_source = 'cloud')::text || ' + ' || coalesce((SELECT rejected FROM recon WHERE entity = 'jpns'), 0)::text
              ELSE 'n/a: staging_cloud not present' END,
         CASE WHEN (SELECT has_schools FROM stg) THEN (SELECT st_jpns FROM d)::text ELSE 'n/a' END,
         CASE WHEN NOT (SELECT has_schools FROM stg) THEN 'info'
              WHEN (SELECT count(*) FROM jpns WHERE legacy_source = 'cloud') + coalesce((SELECT rejected FROM recon WHERE entity = 'jpns'), 0) = (SELECT st_jpns FROM d) THEN 'ok' ELSE 'FAIL' END
  UNION ALL SELECT 'D', 'D2', 'PPD rows + rejects against distinct state/district pairs of staging_cloud.schools (plan 4.5 part 1)',
         CASE WHEN (SELECT has_schools FROM stg) THEN (SELECT count(*) FROM ppds WHERE legacy_source = 'cloud')::text || ' + ' || coalesce((SELECT rejected FROM recon WHERE entity = 'ppds'), 0)::text
              ELSE 'n/a: staging_cloud not present' END,
         CASE WHEN (SELECT has_schools FROM stg) THEN (SELECT st_ppds FROM d)::text ELSE 'n/a' END,
         CASE WHEN NOT (SELECT has_schools FROM stg) THEN 'info'
              WHEN (SELECT count(*) FROM ppds WHERE legacy_source = 'cloud') + coalesce((SELECT rejected FROM recon WHERE entity = 'ppds'), 0) = (SELECT st_ppds FROM d) THEN 'ok' ELSE 'FAIL' END
  UNION ALL SELECT 'D', 'D3', 'schools (cloud) with no state or no district (added, not in plan; PPD scope, #199)',
         (SELECT count(*) FROM schools WHERE legacy_source = 'cloud' AND (nullif(btrim(state), '') IS NULL OR nullif(btrim(district), '') IS NULL))::text,
         'reported; compare with the rehearsal', 'info'
  UNION ALL SELECT 'D', 'D4', 'ppd_officer accounts (cloud) without a district scope (added, not in plan; #199)',
         (SELECT count(*) FROM users x JOIN user_roles r ON r.user_id = x.id AND r.role = 'ppd_officer'
           WHERE x.legacy_source = 'cloud' AND NOT EXISTS (SELECT 1 FROM user_scopes s WHERE s.user_id = x.id AND s.role = 'ppd_officer' AND s.level = 'district'))::text,
         'reported; compare with D3 and the rehearsal', 'info'

  -- ---------------------------------------------------------------- F. plan 4.5 part 1, forced password reset
  UNION ALL SELECT 'F', 'F1', 'cloud accounts flagged must_reset_password (same as A1.11 (e), flagged)', flagged::text,
         '= expected: roster + non-bcrypt + shared default (see F3 to F5)', 'info' FROM u
  UNION ALL SELECT 'F', 'F2', 'cloud accounts migrated (same as A1.11 (e), migrated)', migrated::text, '= entity users in the verify report', 'info' FROM u
  UNION ALL SELECT 'F', 'F3', 'roster accounts by the staged rule (username, no valid e-mail) against note must_reset.roster_account',
         CASE WHEN fs.has_f THEN fs.roster::text ELSE 'n/a: staging_cloud.users not present' END,
         CASE WHEN nt.has_roster THEN nt.roster::text
              ELSE '= note must_reset.roster_account in the B7 output (counter not persisted in this build)' END,
         CASE WHEN NOT fs.has_f OR NOT nt.has_roster THEN 'info' WHEN fs.roster = nt.roster THEN 'ok' ELSE 'FAIL' END FROM fs, nt
  UNION ALL SELECT 'F', 'F4', 'non-bcrypt accounts by the staged hash (includes argon2id and NULL) against note must_reset.non_bcrypt',
         CASE WHEN fs.has_f THEN fs.non_bcrypt::text ELSE 'n/a: staging_cloud.users not present' END,
         CASE WHEN nt.has_non_bcrypt THEN nt.non_bcrypt::text || CASE WHEN nt.partial THEN ' (partial: countsFromCommittedRows = 1)' ELSE '' END
              ELSE '= note must_reset.non_bcrypt in the B7 output (counter not persisted in this build)' END,
         CASE WHEN NOT fs.has_f OR NOT nt.has_non_bcrypt OR nt.partial THEN 'info' WHEN fs.non_bcrypt = nt.non_bcrypt THEN 'ok' ELSE 'FAIL' END FROM fs, nt
  UNION ALL SELECT 'F', 'F5', 'flagged accounts that are neither roster nor non-bcrypt = shared default remainder, at most note must_reset.shared_default',
         CASE WHEN fs.has_f THEN fs.remainder::text ELSE 'n/a: staging_cloud.users not present' END,
         CASE WHEN nt.has_shared THEN '<= ' || nt.shared::text || CASE WHEN nt.partial THEN ' (partial: countsFromCommittedRows = 1)' ELSE '' END
              ELSE '<= note must_reset.shared_default in the B7 output (counter not persisted in this build)' END,
         CASE WHEN NOT fs.has_f OR NOT nt.has_shared OR nt.partial THEN 'info' WHEN fs.remainder <= nt.shared THEN 'ok' ELSE 'FAIL' END FROM fs, nt
  UNION ALL SELECT 'F', 'F6', 'accounts the ETL flags (roster or non-bcrypt/NULL hash by the staged row) but that are NOT flagged in v2 (dropped duplicate e-mails are not counted)',
         CASE WHEN fs.has_f THEN fs.derivable::text ELSE 'n/a: staging_cloud.users not present' END, '0',
         CASE WHEN NOT fs.has_f THEN 'info' WHEN fs.derivable = 0 THEN 'ok' ELSE 'FAIL' END FROM fs
  UNION ALL SELECT 'F', 'F7', 'accounts with a NULL password_hash in v2 against the staged non-bcrypt, non-argon2id accounts (#226 F2)',
         CASE WHEN fs.has_f THEN fs.null_v2::text ELSE 'n/a: staging_cloud.users not present' END,
         CASE WHEN fs.has_f THEN fs.null_expected::text ELSE 'n/a' END,
         CASE WHEN NOT fs.has_f THEN 'info' WHEN fs.null_v2 = fs.null_expected THEN 'ok' ELSE 'FAIL' END FROM fs
  UNION ALL SELECT 'F', 'F8', 'accounts with a NULL password_hash in v2 against note nullHashAccounts (added, not in plan; #226 F2)',
         u.null_hash::text,
         CASE WHEN nt.has_null THEN nt.null_hash::text ELSE '= note nullHashAccounts in the B7 output (counter not persisted in this build)' END,
         CASE WHEN NOT nt.has_null THEN 'info' WHEN u.null_hash = nt.null_hash THEN 'ok' ELSE 'FAIL' END FROM u, nt
  UNION ALL SELECT 'F', 'F9', 'flagged accounts with no username and no e-mail in v2 against note flaggedWithoutLoginId (added, not in plan)',
         u.no_login_id::text,
         CASE WHEN nt.has_nologin THEN nt.no_login::text ELSE '= note flaggedWithoutLoginId in the B7 output (counter not persisted in this build)' END,
         CASE WHEN NOT nt.has_nologin THEN 'info' WHEN u.no_login_id = nt.no_login THEN 'ok' ELSE 'FAIL' END FROM u, nt
  UNION ALL SELECT 'F', 'F10', 'note rosterDefaultHashesWarning: 1 = the shared roster default hashes were not supplied, so those accounts are NOT flagged (added, not in plan)',
         CASE WHEN nt.has_warn THEN nt.warn::text || ' (default hashes known: ' || coalesce(nt.hashes::text, '?') || ')' ELSE 'not persisted in this build' END,
         CASE WHEN nt.has_warn THEN '0' ELSE '= no warning line in the B7 output' END,
         CASE WHEN NOT nt.has_warn THEN 'info' WHEN nt.warn = 0 THEN 'ok' ELSE 'FAIL' END FROM nt

  -- ---------------------------------------------------------------- U. username clashes across schools (#226 F1; added, not in plan)
  UNION ALL SELECT 'U', 'U1', 'lower-case usernames used by more than one cloud account (added, not in plan; #226 F1)', dup_names::text, 'reported; compare with the rehearsal', 'info' FROM uname
  UNION ALL SELECT 'U', 'U2', 'accounts that share such a username (added, not in plan; #226 F1)', accounts::text, 'reported; compare with the rehearsal', 'info' FROM uname

  -- ---------------------------------------------------------------- X. rejects (criterion 2 and 3 evidence; plan 4.6 B8 "reject counts by reason")
  UNION ALL SELECT 'X', 'X1.' || r.reason, 'rejects with reason ' || r.reason || ' (criterion 2; B8)',
         coalesce((SELECT sum(n) FROM rej WHERE rej.reason = r.reason), 0)::text, '= verify report / criterion 2 list; explained one by one',
         'info'
    FROM unnest(ARRAY['UNKNOWN_ENUM','ORPHAN_PARENT','DUPLICATE_KEY','INVALID_VALUE','UNSUPPORTED']) AS r(reason)
  UNION ALL SELECT 'X', 'X2', 'ORPHAN_PARENT rejects on users and schools (criterion 3)',
         coalesce((SELECT sum(n) FROM rej WHERE reason = 'ORPHAN_PARENT' AND entity IN ('users', 'schools')), 0)::text, '0',
         CASE WHEN coalesce((SELECT sum(n) FROM rej WHERE reason = 'ORPHAN_PARENT' AND entity IN ('users', 'schools')), 0) = 0 THEN 'ok' ELSE 'FAIL' END
  UNION ALL SELECT 'X', 'X3', 'entities with reject share above 0.1 % (users, schools) or 0.5 % (others) (criterion 2)',
         (SELECT count(*) FROM recon WHERE source_count > 0 AND 100.0 * rejected / source_count > CASE WHEN entity IN ('users', 'schools') THEN 0.1 ELSE 0.5 END)::text, '0',
         CASE WHEN (SELECT count(*) FROM recon WHERE source_count > 0 AND 100.0 * rejected / source_count > CASE WHEN entity IN ('users', 'schools') THEN 0.1 ELSE 0.5 END) = 0 THEN 'ok' ELSE 'FAIL' END

  -- ---------------------------------------------------------------- E. per-entity legacy-keyed counts against the recon report (added, not in plan; B8 "SQL counts equal the verify report")
  UNION ALL SELECT 'E', 'E.0', 'entities whose v2 count differs from etl_recon.loaded or has no recon row (added, not in plan)',
         (SELECT count(*) FROM live l LEFT JOIN recon r ON r.entity = l.entity WHERE r.loaded IS DISTINCT FROM l.n)::text || ' of ' || (SELECT count(*) FROM live)::text, '0',
         CASE WHEN (SELECT count(*) FROM live l LEFT JOIN recon r ON r.entity = l.entity WHERE r.loaded IS DISTINCT FROM l.n) = 0 THEN 'ok' ELSE 'FAIL' END
  UNION ALL SELECT 'E', 'E.' || l.entity, 'v2 rows (legacy cloud) against etl_recon.loaded (added, not in plan)',
         l.n::text, coalesce(r.loaded::text, 'no recon row'), CASE WHEN r.loaded = l.n THEN 'ok' ELSE 'FAIL' END
    FROM live l LEFT JOIN recon r ON r.entity = l.entity

  -- ---------------------------------------------------------------- S. soft reference (the verify check of the same name; added, not in plan)
  UNION ALL SELECT 'S', 'S1', 'answers with neither question nor subject (added, not in plan)',
         (SELECT count(*) FROM practice_answers WHERE legacy_source = 'cloud' AND question_id IS NULL AND subject_id IS NULL)::text, '0',
         CASE WHEN (SELECT count(*) FROM practice_answers WHERE legacy_source = 'cloud' AND question_id IS NULL AND subject_id IS NULL) = 0 THEN 'ok' ELSE 'FAIL' END
)
SELECT check_id, description, value, expected, ok
FROM (
  SELECT grp, check_id, description, value, expected, ok FROM checks
  UNION ALL
  SELECT 'Z', 'Z0', 'rows with ok = FAIL (any FAIL at night is STOP)', count(*) FILTER (WHERE ok = 'FAIL')::text, '0',
         CASE WHEN count(*) FILTER (WHERE ok = 'FAIL') = 0 THEN 'ok' ELSE 'FAIL' END
  FROM checks
) all_rows
ORDER BY grp, check_id;

ROLLBACK;
