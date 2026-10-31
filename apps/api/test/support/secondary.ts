/**
 * Secondary-only (2026-10-29): the demo schools SK Demo Dua/Tiga (DEMO002/3) and SJK(C) Demo Empat (DEMO004) are primary by type and
 * their pupils sit in Darjah 1-6, so every reader hides them. Specs whose fixtures use them as ordinary schools call this once
 * after booting to treat them as secondary (type SMK; with `grades` the pupils also move up to Tingkatan). The hiding itself is
 * covered by dedicated tests.
 */
export async function treatDemoAsSecondary(db: { query: (sql: string, params?: unknown[]) => Promise<unknown> }, grades = true): Promise<void> {
  await db.query(`update schools set type = 'SMK' where code in ('DEMO002', 'DEMO003', 'DEMO004')`)
  if (grades) {
    await db.query(
      `update users set grade = least(grade + 6, 11) where grade <= 6 and school_id in (select id from schools where code in ('DEMO001', 'DEMO002', 'DEMO003', 'DEMO004'))`,
    )
  }
}
