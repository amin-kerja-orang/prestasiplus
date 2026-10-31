import { POC_QUESTION_KEYS, pocQuestionId } from '../../../src/modules/bijak/papers/poc'

/**
 * Consistency checks of the PoC profile (BE-26). One SQL assertion per rule; each query returns the VIOLATING rows
 * (a `detail` text column), so an empty result means the rule holds. `verifyPocProfile` runs them all and returns
 * the failures; `pocProfileSeed` calls it at the end of the run and throws when the list is not empty.
 *
 * Rules and the tables behind them (names follow apps/api/prisma/schema):
 * - wallet balance = ledger sum per user (wallets, coin_ledger; `is_test` rows written under Mod Pelajar are
 *   excluded, like every aggregate);
 * - every ledger user has a wallet (a wallet is created by the first credit);
 * - every practice answer row has valid dimensions (practice_answers vs subjects, education_levels, chapters, topics);
 * - enrolments reference an existing class and an existing student (enrolments, classrooms, users, user_roles);
 * - every paper placement references a published, active question (paper_placements, questions, question_versions);
 * - no orphan rows in the relations that have NO database foreign key (the FK-protected ones cannot be orphaned).
 *
 * Not covered, because the table does not exist yet or has no seed: attempt_answers.part_id (a string key into the
 * authored parts, not a foreign key), jobs.entity_id and audit_events.target_id (polymorphic, runtime only).
 * Fictitious data only; deterministic; read-only.
 */

/** Anything that can run a read-only SQL text and return its rows (Prisma, a pg pool, a test transaction). */
export interface Queryable {
  query<T = Record<string, unknown>>(sql: string): Promise<T[]>
}

export interface VerifyRule {
  /** Stable machine name, used in failure reports and tests. */
  name: string
  description: string
  /** Selects the violating rows as `detail` (text). Must be a single read-only statement. */
  sql: string
}

export interface VerifyFailure {
  rule: string
  description: string
  /** Total violating rows. */
  count: number
  /** The first few `detail` values. */
  examples: string[]
}

/** Ids of the in-code PoC questions (reserved block 9_000_000_000+, served as published by the question bridge). */
const POC_IDS_SQL = POC_QUESTION_KEYS.map((k) => pocQuestionId(k).toString()).join(', ')

const orphan = (name: string, description: string, child: string, column: string, parent: string, extraWhere = ''): VerifyRule => ({
  name,
  description,
  sql: `select '${child}.' || c.id::text || ' -> ${column}=' || c.${column}::text as detail
          from ${child} c left join ${parent} p on p.id = c.${column}
         where c.${column} is not null and p.id is null ${extraWhere}
         order by c.id`,
})

export const VERIFY_RULES: readonly VerifyRule[] = [
  {
    name: 'wallet_balance_equals_ledger_sum',
    description: 'Every wallet balance (current_syiling) equals the sum of that user\'s ledger amounts (is_test rows excluded).',
    sql: `select 'user ' || w.user_id::text || ': wallet ' || w.current_syiling::text || ' vs ledger ' || coalesce(s.total, 0)::text as detail
            from wallets w
            left join (select user_id, sum(amount)::bigint as total from coin_ledger where not is_test group by user_id) s on s.user_id = w.user_id
           where w.current_syiling <> coalesce(s.total, 0)
           order by w.user_id`,
  },
  {
    name: 'ledger_user_has_wallet',
    description: 'Every user with coin ledger rows has a wallet.',
    sql: `select distinct 'user ' || l.user_id::text || ' has ledger rows and no wallet' as detail
            from coin_ledger l left join wallets w on w.user_id = l.user_id
           where not l.is_test and w.id is null
           order by 1`,
  },
  {
    name: 'answer_dimensions_valid',
    description:
      'Every practice answer has a subject and a level (migrated rows excepted), a chapter of that subject, a topic of that chapter, a label A-H or none, a difficulty 1-5 or none.',
    sql: `select 'practice_answers.' || a.id::text || ': ' ||
                 case when a.subject_id is null or a.education_level_id is null then 'missing subject or level'
                      when a.chapter_id is not null and not exists (select 1 from chapters c where c.id = a.chapter_id and c.subject_id = a.subject_id) then 'chapter not in subject'
                      when a.topic_id is not null and not exists (select 1 from topics t where t.id = a.topic_id and t.chapter_id = a.chapter_id) then 'topic not in chapter'
                      when a.selected_label is not null and a.selected_label !~ '^[A-H]$' then 'bad selected_label'
                      else 'difficulty out of range' end as detail
            from practice_answers a
           where not a.historical and (
                 a.subject_id is null or a.education_level_id is null
              or (a.chapter_id is not null and not exists (select 1 from chapters c where c.id = a.chapter_id and c.subject_id = a.subject_id))
              or (a.topic_id is not null and not exists (select 1 from topics t where t.id = a.topic_id and t.chapter_id = a.chapter_id))
              or (a.selected_label is not null and a.selected_label !~ '^[A-H]$')
              or (a.difficulty is not null and a.difficulty not between 1 and 5))
           order by a.id`,
  },
  {
    name: 'enrolment_classroom_exists',
    description: 'Every enrolment references an existing class.',
    sql: `select 'enrolments.' || e.id::text || ' -> classroom ' || e.classroom_id::text as detail
            from enrolments e left join classrooms c on c.id = e.classroom_id
           where c.id is null order by e.id`,
  },
  {
    name: 'enrolment_student_exists',
    description: 'Every enrolment references an existing user who holds the student role.',
    sql: `select 'enrolments.' || e.id::text || ' -> student ' || e.student_id::text as detail
            from enrolments e
           where not exists (select 1 from user_roles r where r.user_id = e.student_id and r.role = 'student')
           order by e.id`,
  },
  {
    name: 'placement_question_published',
    description:
      'Every paper placement references either an in-code PoC question (reserved id block, always published) or an existing, active bank question whose live version is published.',
    sql: `select 'paper_placements.' || p.id::text || ' -> question ' || p.question_id::text as detail
            from paper_placements p
           where p.question_id not in (${POC_IDS_SQL}) and not exists (
                 select 1 from questions q
                   join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no
                  where q.id = p.question_id and q.is_active and v.status = 'approved')
           order by p.id`,
  },
  orphan('orphan_practice_session_questions', 'practice_session_questions.question_id points at an existing question.', 'practice_session_questions', 'question_id', 'questions'),
  orphan('orphan_practice_answers_question', 'practice_answers.question_id (when set) points at an existing question.', 'practice_answers', 'question_id', 'questions'),
  orphan('orphan_practice_checks_question', 'practice_checks.question_id points at an existing question.', 'practice_checks', 'question_id', 'questions'),
  orphan('orphan_revision_queue_question', 'revision_queue.question_id points at an existing question.', 'revision_queue', 'question_id', 'questions'),
  {
    // question_id is text here (it also carries the reserved PoC ids 9_000_000_000 .. 9_999_999_999, which live in
    // code, not in the questions table: src/modules/bijak/papers/poc). Only a bank-range id has to exist.
    name: 'orphan_aggregate_items_question',
    description: 'practice_attempt_aggregate_items.question_id is numeric and, outside the reserved PoC id block, points at an existing question.',
    sql: `select 'practice_attempt_aggregate_items.' || i.id::text || ' -> question ' || i.question_id as detail
            from practice_attempt_aggregate_items i
           where i.question_id !~ '^[0-9]{1,18}$'
              or (i.question_id::bigint < 9000000000 and not exists (select 1 from questions q where q.id = i.question_id::bigint))
           order by i.id`,
  },
  orphan('orphan_exam_attempts_paper', 'exam_attempts.paper_id (when set) points at an existing paper.', 'exam_attempts', 'paper_id', 'papers'),
  {
    name: 'orphan_session_credits_session',
    description: 'session_credits.session_id points at an existing practice session.',
    sql: `select 'session_credits.' || c.id::text || ' -> session ' || c.session_id::text as detail
            from session_credits c left join practice_sessions s on s.id = c.session_id
           where s.id is null order by c.id`,
  },
]

const EXAMPLES = 5

/** Runs every rule; returns one failure per rule that found violating rows (empty list = the profile is coherent). */
export async function verifyPocProfile(db: Queryable, rules: readonly VerifyRule[] = VERIFY_RULES): Promise<VerifyFailure[]> {
  const failures: VerifyFailure[] = []
  for (const rule of rules) {
    const rows = await db.query<{ detail: string }>(rule.sql)
    if (rows.length > 0) {
      failures.push({ rule: rule.name, description: rule.description, count: rows.length, examples: rows.slice(0, EXAMPLES).map((r) => String(r.detail)) })
    }
  }
  return failures
}

export function formatFailures(failures: readonly VerifyFailure[]): string {
  return failures.map((f) => `${f.rule}: ${f.count} violation(s), e.g. ${f.examples.join('; ')}`).join('\n')
}
