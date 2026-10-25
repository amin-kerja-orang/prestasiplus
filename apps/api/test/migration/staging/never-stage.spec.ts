import { describe, expect, it } from 'vitest'

import { findTable, TABLES } from '../../../src/migration/ddl/spec'

/**
 * L1 (PDPA data minimisation): a pinned never-stage list. A column is staged only when a reader needs it, so personal and
 * free-text columns that no code reads must never come back into `ddl/spec.ts` by accident. To stage one on purpose, remove
 * it from this list in the same change and record the reader in `docs/architecture/v2-backend-deviations.md`.
 * No database: this reads the spec only.
 */

/** Framework and session tables of the source application: they hold tokens or queue payloads and are never copied. */
const NEVER_TABLES = [
  'password_resets', 'password_reset_tokens', 'personal_access_tokens', 'sessions',
  'jobs', 'job_batches', 'failed_jobs', 'cache', 'cache_locks',
] as const

/** [table, column] pairs: sensitive or free text that nothing reads (FIT-FIX and PDPA-MIN). */
const NEVER_COLUMNS: readonly (readonly [string, string])[] = [
  // FIT-FIX
  ['users', 'faith'], ['users', 'google_id'],
  ['mood_checkins', 'note'],
  ['interventions', 'before_mood'], ['interventions', 'after_mood'], ['interventions', 'action_taken'],
  ['chatbot_messages', 'body'],
  ['student_notes', 'title'], ['student_notes', 'body'],
  ['study_schedules', 'focus_topic'],
  ['structured_attempt_answers', 'answer'],
  ['teacher_reference_documents', 'file_path'],
  ['teacher_reference_papers', 'title'],
  ['paper_documents', 'source_file'],
  ['paper_document_pages', 'path'],
  // PDPA-MIN
  ['psychometric_results', 'details'],
  ['foster_applications', 'applicant_name'], ['foster_applications', 'reason'],
  ['sponsors', 'officer_name'],
  ['audit_logs', 'ip'], ['audit_logs', 'subject_id'],
  ['chatbot_conversations', 'visitor_id'], ['chatbot_conversations', 'start_url'],
]

describe('never-stage list (L1)', () => {
  it.each(NEVER_TABLES)('the spec has no table %s', (table) => {
    expect(TABLES.map((t) => t.name)).not.toContain(table)
  })

  it.each(NEVER_COLUMNS)('%s.%s is not a staged column', (table, column) => {
    const columns = findTable(table)?.columns.map((c) => c.name) ?? []
    expect(columns).not.toContain(column)
  })

  it('login and invite secrets stay in the spec only as redact columns (the loader writes NULL)', () => {
    const users = findTable('users')
    expect(users?.columns.find((c) => c.name === 'remember_token')?.redact).toBe(true)
    expect(users?.columns.find((c) => c.name === 'parent_invite_token')?.redact).toBe(true)
  })

  it('the five PDPA-MIN tables keep their id and foreign keys, so the table counts and row recon do not change', () => {
    for (const [table, fk] of [
      ['psychometric_results', 'user_id'], ['audit_logs', 'user_id'], ['chatbot_conversations', 'user_id'],
    ] as const) {
      expect(findTable(table)?.columns.find((c) => c.name === fk)?.fk, `${table}.${fk}`).toBe('users')
    }
    for (const table of ['sponsors', 'foster_applications']) expect(findTable(table)?.pk, table).toBe('id')
    expect(TABLES.filter((t) => t.group === 'staging')).toHaveLength(89)
    expect(TABLES.filter((t) => t.group === 'archive')).toHaveLength(38)
  })
})
