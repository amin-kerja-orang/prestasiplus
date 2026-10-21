/**
 * Test-only stand-in for v2 tables whose owning card is not merged on this branch (BE-23 gamification, BE-13
 * `spm_targets`, BE-19 `timeline_posts`, BE-20 `feedback`). `ensureTargets` creates a table only when it does not exist,
 * with the columns and checks Part B writes (copied from the owning cards' migrations 0019, 0022, 0030 and 0023), so the
 * Part B DB specs run before those cards are rebased in. Once the real migrations are on the branch nothing is created.
 * Never used outside the tests.
 */
import type pg from 'pg'

const LEGACY = (t: string): string => `
  legacy_source text, legacy_id text,
  constraint ck_${t}_legacy_source check (legacy_source is null or legacy_source in ('cloud', 'my')),
  constraint uq_${t}_legacy unique (legacy_source, legacy_id)`

const TS = `created_at timestamptz not null default current_timestamp, updated_at timestamptz not null default current_timestamp`

const DDL: Record<string, string> = {
  challenges: `create table challenges (
    id bigint generated always as identity primary key,
    title text not null, description text not null default '', icon text not null default '',
    challenge_type text not null, metric text, target_value integer not null,
    reward_syiling integer not null default 0, reward_xp integer not null default 0,
    difficulty text not null default 'medium', sort_order integer not null default 0, is_active boolean not null default true,
    ${TS}, ${LEGACY('challenges')},
    constraint ck_challenges_challenge_type check (challenge_type in ('quiz_count', 'accuracy', 'topic_variety', 'streak', 'time_spent')),
    constraint ck_challenges_amounts check (target_value >= 1 and reward_syiling >= 0 and reward_xp >= 0))`,
  challenge_completions: `create table challenge_completions (
    id bigint generated always as identity primary key,
    user_id bigint not null references users(id) on delete cascade,
    challenge_id bigint not null references challenges(id) on delete cascade,
    completion_date date not null, completed_at timestamptz not null default current_timestamp, is_test boolean not null default false,
    ${TS}, ${LEGACY('challenge_completions')},
    constraint uq_challenge_completions_user_challenge_date unique (user_id, challenge_id, completion_date))`,
  achievements: `create table achievements (
    id bigint generated always as identity primary key,
    name text not null, description text not null default '', icon text not null default '', rarity text not null default 'common',
    reward_syiling integer not null default 0, reward_xp integer not null default 0,
    criterion_kind text, criterion_min integer, criterion_accuracy numeric(5, 2), progress_target integer, legacy_criteria_text text,
    ${TS}, ${LEGACY('achievements')},
    constraint ck_achievements_criterion_pair check ((criterion_kind is null) = (criterion_min is null)))`,
  user_achievements: `create table user_achievements (
    id bigint generated always as identity primary key,
    user_id bigint not null references users(id) on delete cascade,
    achievement_id bigint not null references achievements(id) on delete cascade,
    unlocked_at timestamptz not null default current_timestamp, is_test boolean not null default false,
    ${TS}, ${LEGACY('user_achievements')},
    constraint uq_user_achievements_user_achievement unique (user_id, achievement_id))`,
  referral_codes: `create table referral_codes (
    id bigint generated always as identity primary key,
    user_id bigint not null references users(id) on delete cascade, code text not null,
    ${TS}, ${LEGACY('referral_codes')},
    constraint uq_referral_codes_user_id unique (user_id), constraint uq_referral_codes_code unique (code),
    constraint ck_referral_codes_code check (char_length(code) between 1 and 50))`,
  referrals: `create table referrals (
    id bigint generated always as identity primary key,
    referrer_id bigint not null references users(id) on delete cascade, referee_id bigint not null references users(id) on delete cascade,
    code_used text not null, rewarded boolean not null default false,
    ${TS}, ${LEGACY('referrals')},
    constraint uq_referrals_referee_id unique (referee_id), constraint ck_referrals_not_self check (referrer_id <> referee_id))`,
  gamification_settings: `create table gamification_settings (
    id bigint generated always as identity primary key,
    key text not null, value numeric(12, 2) not null, label text not null,
    ${TS}, ${LEGACY('gamification_settings')},
    constraint uq_gamification_settings_key unique (key),
    constraint ck_gamification_settings_key check (key in ('coins_per_question', 'cash_rate_coins', 'cash_rate_sen', 'min_cash_withdrawal',
      'cash_withdrawal_enabled', 'reward_budget_sen_session', 'reward_budget_sen_month', 'current_session_year', 'flat_quiz_reward', 'games_award_syiling')))`,
  spm_targets: `create table spm_targets (
    id bigint generated always as identity primary key,
    user_id bigint not null references users(id) on delete cascade, subject_id bigint not null references subjects(id) on delete cascade,
    target_grade text not null, is_test boolean not null default false,
    ${TS}, ${LEGACY('spm_targets')},
    constraint ck_spm_targets_target_grade check (target_grade in ('A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E')),
    constraint uq_spm_targets_user_id_subject_id unique (user_id, subject_id))`,
  timeline_posts: `create table timeline_posts (
    id bigint generated always as identity primary key,
    user_id bigint not null references users(id) on delete cascade, title text not null, category text not null,
    event_date date, story text, is_test boolean not null default false,
    ${TS}, ${LEGACY('timeline_posts')},
    constraint ck_timeline_posts_category check (category in ('sijil', 'pencapaian', 'aktiviti', 'cerita', 'lain')),
    constraint ck_timeline_posts_title check (char_length(btrim(title)) between 1 and 150),
    constraint ck_timeline_posts_story check (story is null or char_length(story) <= 2000))`,
  feedback: `create table feedback (
    id bigint generated always as identity primary key,
    user_id bigint not null references users(id) on delete cascade, role text not null, school_id bigint,
    month date not null, nps smallint, satisfaction smallint not null, usability smallint, relevance smallint, score smallint, comment text,
    is_test boolean not null default false,
    ${TS}, ${LEGACY('feedback')},
    constraint ck_feedback_role check (role in ('admin', 'school_admin', 'ppd_officer', 'teacher', 'student', 'parent', 'sponsor')),
    constraint ck_feedback_satisfaction check (satisfaction between 1 and 5),
    constraint ck_feedback_scores check ((usability is null or usability between 1 and 5) and (relevance is null or relevance between 1 and 5) and (score is null or score between 1 and 5)),
    constraint uq_feedback_user_id_month_is_test unique (user_id, month, is_test))`,
}

/** Creates the listed target tables that are missing (in dependency order) and returns the names it created. */
export async function ensureTargets(pool: pg.Pool, tables: readonly string[]): Promise<string[]> {
  const created: string[] = []
  for (const t of tables) {
    const sql = DDL[t]
    if (!sql) throw new RangeError(`No stand-in DDL for "${t}".`)
    const exists = await pool.query<{ ok: boolean }>(`select to_regclass($1) is not null as ok`, [t])
    if (exists.rows[0]?.ok) continue
    await pool.query(sql)
    created.push(t)
  }
  return created
}

/** Target tables of the gamification steps and of the operations steps, in dependency order. */
export const GAMIFICATION_TARGETS = [
  'challenges', 'challenge_completions', 'achievements', 'user_achievements', 'referral_codes', 'referrals', 'gamification_settings', 'spm_targets',
] as const
export const OPS_TARGETS = ['timeline_posts', 'feedback'] as const
