/**
 * Action names written to `audit_events.action`. Append-only registry: a card adds its own lines at
 * the end, never reorders or renames. BE-03: `auth.*` and `session.*`; BE-08: `curriculum.*`; BE-16: `bijak.attempt.*`.
 */
export const AUDIT_ACTIONS = {
  LOGIN_FAILED: 'auth.login.failed',
  LOGIN_SUCCEEDED: 'auth.login.succeeded',
  LOGOUT: 'auth.logout',
  ROLE_SWITCHED: 'session.role.switched',
  MODE_ENTERED: 'session.mode.entered',
  MODE_EXITED: 'session.mode.exited',
  CURRICULUM_LEVEL_CREATED: 'curriculum.level.created',
  CURRICULUM_LEVEL_UPDATED: 'curriculum.level.updated',
  CURRICULUM_LEVEL_DELETED: 'curriculum.level.deleted',
  CURRICULUM_LEVEL_ACTIVE_CHANGED: 'curriculum.level.active_changed',
  CURRICULUM_SUBJECT_CREATED: 'curriculum.subject.created',
  CURRICULUM_SUBJECT_UPDATED: 'curriculum.subject.updated',
  CURRICULUM_SUBJECT_DELETED: 'curriculum.subject.deleted',
  CURRICULUM_SUBJECT_ACTIVE_CHANGED: 'curriculum.subject.active_changed',
  CURRICULUM_CHAPTER_CREATED: 'curriculum.chapter.created',
  CURRICULUM_CHAPTER_UPDATED: 'curriculum.chapter.updated',
  CURRICULUM_CHAPTER_DELETED: 'curriculum.chapter.deleted',
  CURRICULUM_TOPIC_CREATED: 'curriculum.topic.created',
  CURRICULUM_TOPIC_UPDATED: 'curriculum.topic.updated',
  CURRICULUM_TOPIC_DELETED: 'curriculum.topic.deleted',
  CURRICULUM_SUBTOPIC_CREATED: 'curriculum.subtopic.created',
  CURRICULUM_SUBTOPIC_UPDATED: 'curriculum.subtopic.updated',
  CURRICULUM_SUBTOPIC_DELETED: 'curriculum.subtopic.deleted',
  BIJAK_ATTEMPT_STARTED: 'bijak.attempt.started',
  BIJAK_ATTEMPT_SUBMITTED: 'bijak.attempt.submitted',
  BIJAK_ATTEMPT_AUTO_SUBMITTED: 'bijak.attempt.auto_submitted',
  BIJAK_ATTEMPT_ABANDONED: 'bijak.attempt.abandoned',
  QUESTION_CREATED: 'question.created',
  QUESTION_UPDATED: 'question.updated',
  QUESTION_DELETED: 'question.deleted',
  QUESTION_BULK_ACTION: 'question.bulk_action',
  QUESTION_STATUS_CHANGED: 'question.status.changed',
} as const
export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]
