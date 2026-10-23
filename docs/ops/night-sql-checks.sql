-- night-sql-checks.sql
-- Read-only SQL checks of the v2 cutover plan, section 4.5 part 1 (docs/ops/v2-cutover-plan.md).
-- Run at night step B8 on the production target (after `migrate:verify`), in the A4 rehearsal as T17, and again at C2.
--
-- HOW TO RUN (psql, from the VPS shell; the target database already holds staging_cloud and the migrated rows)
--   Connect with a role that can only read (SELECT on the v2 tables, etl_id_map, etl_runs, etl_recon, etl_rejects and
--   staging_cloud.*). Put the connection in the environment or in ~/.pgpass / a service file; NEVER put a password,
--   a hash or a connection string with a password on the command line (argv shows in `ps` and in shell history).
--
--     export PGHOST=... PGPORT=... PGDATABASE=<db> PGUSER=<read-only role>      # no password here; use ~/.pgpass
--     psql -X -v ON_ERROR_STOP=1 \
--          -v verify_wallets_differing=<N from the verify report> \
--          -v report_roster=<N> -v report_non_bcrypt=<N> -v report_shared_default=<N> \
--          -f docs/ops/night-sql-checks.sql
--
--   The four -v values are plain counts copied from reports: `verify_wallets_differing` is the `actual=` number of the verify
--   line "wallet balance versus ledger sum (users with a difference)" (the "D" of "D of them differ"); the three `report_*`
--   values are the `must_reset.roster_account`, `must_reset.non_bcrypt` and `must_reset.shared_default` counters of the
--   `migrate:core` apply report. They carry no personal data. Without them C3 and C5 report `pass = f`
--   (`counts_supplied = f`): a criterion with no evidence counts as not met (plan section 5).
--   -X skips any psql startup file; ON_ERROR_STOP makes psql stop with exit code 3 at the first SQL error (for example a
--   missing staging_cloud schema), which is a STOP, never a pass.
--
-- WHAT IT DOES
--   One `BEGIN TRANSACTION READ ONLY` ... `ROLLBACK`. Every statement between them is a SELECT, so the server refuses any
--   write. Every result row holds named counts and a boolean `pass`; nothing else: no id, name, e-mail, IC, phone,
--   hash or row value. Samples are chosen by surrogate legacy id, in a fixed order (`ORDER BY md5(legacy_id)`), so the
--   same rows are sampled in every run and by every operator. The populations and the formulas are those of
--   `migrate:verify` (apps/api/src/migration/verify/checks.ts) and of the loaders: a staged row that the loader
--   rejected (etl_rejects of the latest succeeded apply run of that entity) is not expected in v2, exactly as
--   verify's "population rule" leaves the rejects to the entity table.
--
--   C0  guard: staged and migrated populations are not empty (an empty target would pass everything vacuously).
--   C1  per role, 20 sampled users: migrated practice sessions = staged sessions - rejected sessions.
--   C2  per role, 20 sampled users: migrated practice answers  = staged answers  - rejected answers.
--   C3  50 sampled wallets: balance and ledger sum equal the staged values (verify's drift rule: only wallets that have
--       migrated ledger rows can differ, compared with SUM(amount)); the full-population count of differing wallets
--       equals the number the verify report lists.
--   C4  jpns and ppds equal the distinct states and (state, district) pairs of the staged schools (verify's rule:
--       rows + rejected derived rows), and cover every state / district of the migrated schools.
--   C5  accounts forced to reset their password (users.must_reset_password), split by reason where SQL can derive it:
--       roster (username and no valid e-mail), non-bcrypt (staged hash is not bcrypt cost 4..13, which includes
--       argon2id and the NULL hash) and the remainder, which can only be a shared default hash (the list of default
--       hashes is a run-time secret, so SQL cannot see it; the remainder is compared with the report).
--
-- WHAT "PASS" MEANS
--   Every result row shows `pass = t` and psql exits 0 (a row with `pass = f` does not change the exit code: read the
--   rows, or count them: `psql ... | grep -c '| f *$'` must print 0). Any `f`, any SQL error or any non-zero exit is a
--   STOP at B8 (plan 4.6) and a failed criterion 9 (plan section 5). Do not "fix" a number to make a row pass.
--   Rows with `pass = t` still need the counts in them to be plausible; read them once.
--
-- WHAT THE OPERATOR POSTS
--   Counts only: copy the result rows (the column names and the numbers) into the B8 evidence. Never post anything
--   else from the database, and never run a second query to find out WHICH user, wallet or school failed: report the
--   failing check and its counts and stop; the LEAD decides.
--
-- Notes on the shape of the data (checked against the loaders)
--   * Legacy source is 'cloud'. Users, sessions and answers are mapped through etl_id_map (entity users); wallets and
--     ledger rows are loaded with `register: false` (no etl_id_map row), so wallets are sampled by wallets.legacy_id,
--     which is the staged student_wallets.id (a surrogate id).
--   * The roster and hash rules are those of transform/users.ts and transform/secrets.ts.
--   * No delta runs at night, so no "deleted at source" adjustment is made here.

\set src cloud
\if :{?verify_wallets_differing}
\else
  \set verify_wallets_differing ''
\endif
\if :{?report_roster}
\else
  \set report_roster ''
\endif
\if :{?report_non_bcrypt}
\else
  \set report_non_bcrypt ''
\endif
\if :{?report_shared_default}
\else
  \set report_shared_default ''
\endif

BEGIN TRANSACTION READ ONLY;

-- ============================================================================================================
-- C0  Guard: the populations the other checks sample from exist.
-- ============================================================================================================
SELECT 'C0 populations' AS check_id,
       (SELECT count(*) FROM staging_cloud.users)                                    AS staged_users,
       (SELECT count(*) FROM users WHERE legacy_source = :'src')                      AS migrated_users,
       (SELECT count(*) FROM practice_sessions WHERE legacy_source = :'src')          AS migrated_sessions,
       (SELECT count(*) FROM practice_answers WHERE legacy_source = :'src')           AS migrated_answers,
       (SELECT count(*) FROM wallets WHERE legacy_source = :'src')                    AS migrated_wallets,
       (SELECT count(*) FROM schools WHERE legacy_source = :'src')                    AS migrated_schools,
       (SELECT count(*) FROM etl_id_map WHERE legacy_source = :'src' AND entity = 'users') AS id_map_users,
       (    (SELECT count(*) FROM users WHERE legacy_source = :'src') > 0
        AND (SELECT count(*) FROM practice_sessions WHERE legacy_source = :'src') > 0
        AND (SELECT count(*) FROM practice_answers WHERE legacy_source = :'src') > 0
        AND (SELECT count(*) FROM wallets WHERE legacy_source = :'src') > 0
        AND (SELECT count(*) FROM schools WHERE legacy_source = :'src') > 0
        AND (SELECT count(*) FROM etl_id_map WHERE legacy_source = :'src' AND entity = 'users')
            = (SELECT count(*) FROM users WHERE legacy_source = :'src'))               AS pass;

-- ============================================================================================================
-- C1  Practice sessions per sampled user, per role: migrated = staged - rejected.
-- ============================================================================================================
WITH latest AS (
  SELECT max(rc.run_id) AS run_id
  FROM etl_recon rc JOIN etl_runs er ON er.id = rc.run_id
  WHERE rc.entity = 'practice_sessions' AND er.mode = 'apply' AND er.status = 'succeeded' AND :'src' = ANY (er.sources)
),
migrated_users AS (
  SELECT r.role, u.id AS user_id, m.legacy_id
  FROM etl_id_map m
  JOIN users u ON u.id::text = m.new_id AND u.legacy_source = m.legacy_source
  JOIN user_roles r ON r.user_id = u.id
  WHERE m.legacy_source = :'src' AND m.entity = 'users'
),
ranked AS (
  SELECT role, user_id, legacy_id,
         row_number() OVER (PARTITION BY role ORDER BY md5(legacy_id), legacy_id) AS rn,
         count(*) OVER (PARTITION BY role) AS role_users
  FROM migrated_users
),
per_user AS (
  SELECT k.role, k.role_users,
         (SELECT count(*) FROM staging_cloud.practice_sessions s WHERE s.user_id = k.legacy_id::bigint) AS staged,
         (SELECT count(*) FROM staging_cloud.practice_sessions s
           WHERE s.user_id = k.legacy_id::bigint
             AND EXISTS (SELECT 1 FROM etl_rejects rj, latest l
                          WHERE rj.run_id = l.run_id AND rj.entity = 'practice_sessions' AND rj.legacy_id = s.id::text)) AS rejected,
         (SELECT count(*) FROM practice_sessions p WHERE p.user_id = k.user_id AND p.legacy_source = :'src') AS migrated
  FROM ranked k
  WHERE k.rn <= 20
)
SELECT 'C1 sessions per sampled user' AS check_id,
       role,
       max(role_users)                                        AS role_users,
       count(*)                                               AS sampled_users,
       sum(staged)                                            AS staged_sessions,
       sum(rejected)                                          AS rejected_sessions,
       sum(migrated)                                          AS migrated_sessions,
       count(*) FILTER (WHERE staged - rejected <> migrated)  AS users_differing,
       (count(*) = least(20, max(role_users)) AND count(*) FILTER (WHERE staged - rejected <> migrated) = 0) AS pass
FROM per_user
GROUP BY role
ORDER BY role;

-- ============================================================================================================
-- C2  Practice answers per sampled user, per role: migrated = staged - rejected.
-- ============================================================================================================
WITH latest AS (
  SELECT max(rc.run_id) AS run_id
  FROM etl_recon rc JOIN etl_runs er ON er.id = rc.run_id
  WHERE rc.entity = 'practice_answers' AND er.mode = 'apply' AND er.status = 'succeeded' AND :'src' = ANY (er.sources)
),
migrated_users AS (
  SELECT r.role, u.id AS user_id, m.legacy_id
  FROM etl_id_map m
  JOIN users u ON u.id::text = m.new_id AND u.legacy_source = m.legacy_source
  JOIN user_roles r ON r.user_id = u.id
  WHERE m.legacy_source = :'src' AND m.entity = 'users'
),
ranked AS (
  SELECT role, user_id, legacy_id,
         row_number() OVER (PARTITION BY role ORDER BY md5(legacy_id), legacy_id) AS rn,
         count(*) OVER (PARTITION BY role) AS role_users
  FROM migrated_users
),
per_user AS (
  SELECT k.role, k.role_users,
         (SELECT count(*) FROM staging_cloud.question_attempts a WHERE a.user_id = k.legacy_id::bigint) AS staged,
         (SELECT count(*) FROM staging_cloud.question_attempts a
           WHERE a.user_id = k.legacy_id::bigint
             AND EXISTS (SELECT 1 FROM etl_rejects rj, latest l
                          WHERE rj.run_id = l.run_id AND rj.entity = 'practice_answers' AND rj.legacy_id = a.id::text)) AS rejected,
         (SELECT count(*) FROM practice_answers p WHERE p.user_id = k.user_id AND p.legacy_source = :'src') AS migrated
  FROM ranked k
  WHERE k.rn <= 20
)
SELECT 'C2 answers per sampled user' AS check_id,
       role,
       max(role_users)                                        AS role_users,
       count(*)                                               AS sampled_users,
       sum(staged)                                            AS staged_answers,
       sum(rejected)                                          AS rejected_answers,
       sum(migrated)                                          AS migrated_answers,
       count(*) FILTER (WHERE staged - rejected <> migrated)  AS users_differing,
       (count(*) = least(20, max(role_users)) AND count(*) FILTER (WHERE staged - rejected <> migrated) = 0) AS pass
FROM per_user
GROUP BY role
ORDER BY role;

-- ============================================================================================================
-- C3  Wallets: balance versus ledger sum.
--     Sample: 50 migrated wallets by md5(legacy_id). Per wallet, the v2 balance and the v2 ledger sum must equal the staged
--     balance and the staged sum over the ledger rows that were loaded (verify's population rule). The drift rule is
--     verify's: a wallet that has migrated ledger rows "differs" when current_syiling <> SUM(amount); a wallet with no
--     ledger rows is counted apart and never differs. The full-population count of differing wallets must equal the
--     number in the verify report (psql variable verify_wallets_differing).
-- ============================================================================================================
WITH ranked AS (
  SELECT w.user_id, w.legacy_id, w.current_syiling,
         row_number() OVER (ORDER BY md5(w.legacy_id), w.legacy_id) AS rn
  FROM wallets w
  WHERE w.legacy_source = :'src'
),
per_wallet AS (
  SELECT k.current_syiling,
         sw.syiling_balance AS staged_balance,
         (SELECT sum(l.amount) FROM coin_ledger l WHERE l.user_id = k.user_id AND l.legacy_source = :'src') AS v2_sum,
         (SELECT count(*) FROM coin_ledger l WHERE l.user_id = k.user_id AND l.legacy_source = :'src') AS v2_rows,
         (SELECT sum(t.amount) FROM staging_cloud.coin_transactions t
           WHERE t.user_id = sw.user_id
             AND EXISTS (SELECT 1 FROM coin_ledger l WHERE l.legacy_source = :'src' AND l.legacy_id = t.id::text)) AS staged_sum
  FROM ranked k
  LEFT JOIN staging_cloud.student_wallets sw ON sw.id::text = k.legacy_id
  WHERE k.rn <= 50
),
full_pop AS (
  SELECT count(l.user_id)                                                 AS with_ledger,
         count(l.user_id) FILTER (WHERE w.current_syiling <> l.s)         AS differing,
         count(*) FILTER (WHERE l.user_id IS NULL)                        AS without_ledger
  FROM wallets w
  LEFT JOIN (SELECT user_id, sum(amount) AS s FROM coin_ledger WHERE legacy_source = :'src' GROUP BY user_id) l
         ON l.user_id = w.user_id
  WHERE w.legacy_source = :'src'
)
SELECT 'C3 wallet balance vs ledger sum' AS check_id,
       (SELECT count(*) FROM per_wallet)                                                         AS sampled_wallets,
       (SELECT count(*) FROM per_wallet WHERE v2_rows > 0)                                       AS sampled_with_ledger,
       (SELECT count(*) FROM per_wallet WHERE v2_rows > 0 AND current_syiling <> v2_sum)         AS sampled_differing,
       (SELECT count(*) FROM per_wallet
         WHERE staged_balance IS NULL
            OR current_syiling <> staged_balance
            OR v2_sum IS DISTINCT FROM staged_sum)                                               AS sampled_not_equal_to_staged,
       f.with_ledger                                                                             AS wallets_with_ledger,
       f.differing                                                                               AS wallets_differing,
       f.without_ledger                                                                          AS wallets_without_ledger,
       nullif(:'verify_wallets_differing', '')::bigint                                           AS verify_report_differing,
       (nullif(:'verify_wallets_differing', '') IS NOT NULL)                                     AS counts_supplied,
       ((SELECT count(*) FROM per_wallet) = least(50, (SELECT count(*) FROM wallets WHERE legacy_source = :'src'))
        AND (SELECT count(*) FROM per_wallet
              WHERE staged_balance IS NULL OR current_syiling <> staged_balance OR v2_sum IS DISTINCT FROM staged_sum) = 0
        AND nullif(:'verify_wallets_differing', '') IS NOT NULL
        AND f.differing = nullif(:'verify_wallets_differing', '')::bigint)                       AS pass
FROM full_pop f;

-- ============================================================================================================
-- C4  Derived JPN / PPD rows versus the distinct states and (state, district) pairs of the schools.
--     Spelling variants are folded as the loader does (whitespace squashed, case-insensitive). Verify's rule:
--     derived rows in v2 + derived rows the loader rejected = distinct staged keys. In addition every state / pair of the
--     migrated schools must have a derived row (rows >= pairs of migrated schools).
-- ============================================================================================================
WITH staged AS (
  SELECT nullif(upper(btrim(regexp_replace(state, '\s+', ' ', 'g'))), '')    AS state_key,
         nullif(upper(btrim(regexp_replace(district, '\s+', ' ', 'g'))), '') AS district_key
  FROM staging_cloud.schools
),
migrated AS (
  SELECT nullif(upper(btrim(regexp_replace(state, '\s+', ' ', 'g'))), '')    AS state_key,
         nullif(upper(btrim(regexp_replace(district, '\s+', ' ', 'g'))), '') AS district_key
  FROM schools WHERE legacy_source = :'src'
),
latest AS (
  SELECT rc.entity, max(rc.run_id) AS run_id
  FROM etl_recon rc JOIN etl_runs er ON er.id = rc.run_id
  WHERE rc.entity IN ('jpns', 'ppds') AND er.mode = 'apply' AND er.status = 'succeeded' AND :'src' = ANY (er.sources)
  GROUP BY rc.entity
),
c AS (
  SELECT
    (SELECT count(DISTINCT state_key) FROM staged)                                                   AS staged_states,
    (SELECT count(DISTINCT state_key) FROM migrated)                                                 AS school_states,
    (SELECT count(*) FROM jpns WHERE legacy_source = :'src')                                         AS jpn_rows,
    (SELECT count(DISTINCT legacy_id) FROM etl_rejects rj JOIN latest l ON l.run_id = rj.run_id AND l.entity = rj.entity
      WHERE rj.entity = 'jpns')                                                                      AS jpn_rejected,
    (SELECT count(*) FROM (SELECT DISTINCT state_key, district_key FROM staged
                            WHERE state_key IS NOT NULL AND district_key IS NOT NULL) d)             AS staged_pairs,
    (SELECT count(*) FROM (SELECT DISTINCT state_key, district_key FROM migrated
                            WHERE state_key IS NOT NULL AND district_key IS NOT NULL) d)             AS school_pairs,
    (SELECT count(*) FROM ppds WHERE legacy_source = :'src')                                         AS ppd_rows,
    (SELECT count(DISTINCT legacy_id) FROM etl_rejects rj JOIN latest l ON l.run_id = rj.run_id AND l.entity = rj.entity
      WHERE rj.entity = 'ppds')                                                                      AS ppd_rejected
)
SELECT 'C4 jpns and ppds vs schools' AS check_id,
       staged_states, school_states, jpn_rows, jpn_rejected,
       staged_pairs, school_pairs, ppd_rows, ppd_rejected,
       (jpn_rows + jpn_rejected = staged_states AND jpn_rows >= school_states
        AND ppd_rows + ppd_rejected = staged_pairs AND ppd_rows >= school_pairs
        AND staged_states > 0 AND staged_pairs > 0)                                                   AS pass
FROM c;

-- ============================================================================================================
-- C5  Accounts forced to reset their password (users.must_reset_password).
--     Population: migrated users (etl_id_map, entity users) joined to their staged row. Reasons derivable in SQL:
--       roster       a username and no valid e-mail in the staged row (transformUser: username not null and email null);
--       non_bcrypt   the staged hash is not bcrypt `$2a/b/x/y$` with cost 04..13 (argon2id, plaintext, other, empty);
--       null_hash    non_bcrypt that is not argon2id: the loader stores NULL (v2 password_hash IS NULL).
--     An account flagged for none of these can only have a shared default hash (secret list, not visible here).
--     Pass: no derivable account is left unflagged; NULL hashes in v2 = expected; roster and non_bcrypt equal the
--     `migrate:core` report counters; the unexplained remainder does not exceed the report's shared_default counter.
-- ============================================================================================================
WITH j AS (
  SELECT x.must_reset_password AS flagged,
         (x.password_hash IS NULL) AS v2_null_hash,
         (nullif(btrim(s.username, E' \t\r\n\f\v'), '') IS NOT NULL
          AND (nullif(lower(btrim(s.email, E' \t\r\n\f\v')), '') IS NULL
               OR lower(btrim(s.email, E' \t\r\n\f\v')) !~ '^[^\s@]+@[^\s@]+$')) AS roster,
         (coalesce(btrim(s.password, E' \t\r\n\f\v'), '') !~ '^\$2[abxy]\$(0[4-9]|1[0-3])\$[./A-Za-z0-9]{53}$') AS non_bcrypt,
         (coalesce(btrim(s.password, E' \t\r\n\f\v'), '')
            ~ '^\$argon2id\$v=\d+\$m=\d+,t=\d+,p=\d+\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$') AS argon2
  FROM etl_id_map m
  JOIN users x ON x.id::text = m.new_id AND x.legacy_source = m.legacy_source
  JOIN staging_cloud.users s ON s.id::text = m.legacy_id
  WHERE m.legacy_source = :'src' AND m.entity = 'users'
),
c AS (
  SELECT count(*)                                                        AS migrated_users,
         count(*) FILTER (WHERE flagged)                                 AS forced_reset_total,
         count(*) FILTER (WHERE roster)                                  AS roster,
         count(*) FILTER (WHERE non_bcrypt)                              AS non_bcrypt,
         count(*) FILTER (WHERE non_bcrypt AND NOT argon2)               AS null_hash_expected,
         count(*) FILTER (WHERE v2_null_hash)                            AS null_hash_v2,
         count(*) FILTER (WHERE (roster OR non_bcrypt) AND NOT flagged)  AS derivable_not_flagged,
         count(*) FILTER (WHERE flagged AND NOT roster AND NOT non_bcrypt) AS other_flagged
  FROM j
)
SELECT 'C5 forced password reset' AS check_id,
       migrated_users, forced_reset_total, roster, non_bcrypt,
       null_hash_expected, null_hash_v2, derivable_not_flagged,
       other_flagged                                         AS shared_default_remainder,
       nullif(:'report_roster', '')::bigint                  AS report_roster,
       nullif(:'report_non_bcrypt', '')::bigint              AS report_non_bcrypt,
       nullif(:'report_shared_default', '')::bigint          AS report_shared_default,
       (nullif(:'report_roster', '') IS NOT NULL AND nullif(:'report_non_bcrypt', '') IS NOT NULL
        AND nullif(:'report_shared_default', '') IS NOT NULL) AS counts_supplied,
       (migrated_users > 0
        AND derivable_not_flagged = 0
        AND null_hash_v2 = null_hash_expected
        AND nullif(:'report_roster', '') IS NOT NULL AND nullif(:'report_non_bcrypt', '') IS NOT NULL
        AND nullif(:'report_shared_default', '') IS NOT NULL
        AND roster = nullif(:'report_roster', '')::bigint
        AND non_bcrypt = nullif(:'report_non_bcrypt', '')::bigint
        AND other_flagged <= nullif(:'report_shared_default', '')::bigint) AS pass
FROM c;

ROLLBACK;
