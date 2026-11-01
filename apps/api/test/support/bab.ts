/**
 * Semakan (draft to review) asks for a Bab on the bulk route too (the submit gate, R1-H-A18). Fixtures that create questions without one give
 * them the first chapter of their subject and level before they send them to Semakan.
 */
export async function giveBab(db: { query(sql: string, params?: unknown[]): Promise<unknown> }, ids: readonly string[]): Promise<void> {
  await db.query(
    `update question_versions v set chapter_id = (select c.id from chapters c where c.subject_id = v.subject_id and c.education_level_id = v.education_level_id order by c.id limit 1)
      where v.question_id = any($1::bigint[]) and v.chapter_id is null`,
    [ids],
  )
}
