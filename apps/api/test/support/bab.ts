/**
 * REQ-B-071 (Q17): a Bab is NOT required at Semakan, Terbitkan or create-as-approved any more (the H-A18 "Sila pilih bab." gate is gone; the
 * approve gate derives the Bab from the curriculum node where there is exactly one). This helper is kept for fixtures that want a Bab on a
 * question for its own reason: Latihan Bab serving, the chapter list, or a spec that checks the Bab is carried over. It gives such questions the
 * first chapter of their subject and level; a question that already has a Bab is left alone.
 */
export async function giveBab(db: { query(sql: string, params?: unknown[]): Promise<unknown> }, ids: readonly string[]): Promise<void> {
  await db.query(
    `update question_versions v set chapter_id = (select c.id from chapters c where c.subject_id = v.subject_id and c.education_level_id = v.education_level_id order by c.id limit 1)
      where v.question_id = any($1::bigint[]) and v.chapter_id is null`,
    [ids],
  )
}
