/**
 * Marks every active seeded blueprint as the serving (Disahkan) version, as an admin verification would. The PoC seed
 * keeps most of them Spec, and a pupil generates from a serving version only (AC-R1-15.3, D76).
 */
export async function serveSeededBlueprints(db: { query: (sql: string) => Promise<unknown> }): Promise<void> {
  await db.query(`update blueprints set source = 'verified', serves_students = true where status = 'active' and source <> 'draft'`)
}
