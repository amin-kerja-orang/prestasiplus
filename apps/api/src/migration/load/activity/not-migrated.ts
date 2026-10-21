/**
 * Source tables `migrate:activity` does not load, with the reason (printed in the report, v2-backend-plan.md
 * 14.7 and v2-data-migration.md sections 3 and 6). The groups add their own entries through `notMigrated`.
 */
export interface NotMigrated {
  table: string
  reason: string
}

export const NOT_MIGRATED_ACTIVITY: readonly NotMigrated[] = [
  // Question bank: archive only (D29a, section 3.3). Dimensions are copied onto the answers at extract time.
  { table: 'questions / question_options / exam_* / question_parts / legacy_canonical_map / ...', reason: 'question bank is reloaded through the intake (D29a); read only as the snapshot source, archive_cloud afterwards' },
  { table: 'review_schedules', reason: 'question-bound; the revision queue is rebuilt from future answers (Q4)' },
  { table: 'question_set_items / question_sets', reason: 'items are question-bound (Q4); OD-10 Q4 A decided (keep headers as needs-rebuild); blocked: `question_sets.classroom_id` NOT NULL needs a cross-half schema change (BE-18 owner)' },
  { table: 'spm_sets / spm_set_question', reason: 'plain question lists; SPM tracking sets are seeded, not migrated' },
  { table: 'question_reports / question_submissions / question_imports', reason: 'question-bound or replaced by the intake (D53 OWN-1)' },
  { table: 'structured_attempts / structured_attempt_answers', reason: 'free-text answers are never migrated (Q5); no v2 target for the header either; OD-10 Q5 A (scores only); `structured_attempts.question_id` NOT NULL' },
  { table: 'part_responses', reason: 'needs the question stem and carries free text and AI grading (Q5)' },
  { table: 'exam_papers / paper_sections / exam_paper_questions / paper_blueprints / blueprint_sections', reason: '.cloud papers are archived, not loaded (BE-15); the attempt header keeps a snapshot title only' },
  // Sensitive categories: never read (Q7, card AC5).
  { table: 'mood_checkins', reason: 'sensitive category (Q7); never read' },
  { table: 'wellbeing_alerts', reason: 'sensitive category (Q7); never read' },
  { table: 'psychometric_results', reason: 'sensitive category (Q7); never read' },
  { table: 'aspirations', reason: 'sensitive category (Q7); never read' },
  { table: 'foster_applications / foster_sponsorships / sponsors', reason: 'sensitive category and Penaja is out of scope (D48, Q7); never read' },
  { table: 'interventions', reason: 'OD-10 Q7 A decided (migrate); deferred: v2 `interventions.alert_description` is NOT NULL and has no staged .cloud column (OD-2 open column)' },
  // Shop / draws skipped per Q8 (no fixed values for the catalogue fields v2 requires).
  { table: 'gifts', reason: 'Q8: category / vendor / token values not available from .cloud; skipped until the lead fixes the values' },
  { table: 'gift_redemptions', reason: 'Q8: depends on gifts (snapshot of the gift); skipped with it' },
  { table: 'lucky_draws', reason: 'Q8: no ticket rows and no fixed values for v2 draws; skipped' },
  // Targets that are not merged yet.
  { table: 'pksk_packages / pksk_accesses / pksk_questions', reason: 'target owned by BE-42, not merged; PKSK questions are not migrated (D29a)' },
  { table: 'battles / battle_participants / battle_queue / battle_invites', reason: 'target owned by BE-44, not merged; queue and invites are transient' },
  { table: 'games / game_sessions / game_rooms / game_room_players', reason: 'targets owned by BE-45, not merged' },
  { table: 'leagues / league_members', reason: 'OD-10 Q13 A decided (keep both kinds); blocked: no ETL card and v2 `leagues` has no legacy columns (half AZ, BE-45)' },
  { table: 'ai_usage_logs', reason: 'OD-23 B decided: not loaded at go-live' },
  { table: 'notifications', reason: 'OD-21 C decided: not loaded' },
  { table: 'headcounts', reason: 'no ETL card until one adds it (GAP-11)' },
  { table: 'chatbot_conversations / chatbot_messages', reason: 'anonymous public-site chats; not migrated in B1 (BE-43)' },
  { table: 'challenges (teacher rows) / study_schedules / broadcasts', reason: 'teacher challenges have no v2 target (GAP-11); schedules and broadcasts are deferred' },
  { table: 'teacher_badges / teacher_badge_user', reason: 'teacher economy is backlog (D53 OWN-10)' },
  // Billing, marketplace, system.
  { table: 'payments / invoices / dunning_logs', reason: 'out of B1 (staged and profiled only)' },
  { table: 'marketplace_sellers / marketplace_products / marketplace_orders', reason: 'staged and profiled only in B1 (BE-46); orders have no v2 table' },
  { table: 'duta_profiles / duta_applications / duta_bookings', reason: 'out of B1; duta rows are seeded' },
  { table: 'student_notes', reason: 'Buku Nota is not in B1 (deferred)' },
  { table: 'settings / feature_flags / audit_logs', reason: 'no v2 store in B1 (BE-28 note); audit_logs are not migrated' },
  { table: 'career_paths / universities / scholarships', reason: 'out of B1 (staged and profiled only)' },
]
