type Db = { query: (sql: string) => Promise<unknown> }

/**
 * Marks every active seeded blueprint as the serving (Disahkan) version, as an admin verification would: one
 * insert-only verification row per blueprint, `source = 'verified'`, `serves_students = true`. The PoC seed keeps them
 * Spec, and a pupil generates from a serving version only (AC-R1-15.3, D76).
 */
export async function serveSeededBlueprints(db: Db): Promise<void> {
  await db.query(
    `insert into blueprint_verifications (blueprint_id, verified_by_id, verifier_role, structure_hash, check_result, evidence_snapshot)
     select b.id, (select min(id) from users), 'admin', b.structure_hash, '{}'::jsonb, '[]'::jsonb
       from blueprints b where b.status = 'active' and b.source <> 'draft'`,
  )
  await db.query(`update blueprints b set source = 'verified', serves_students = true,
      verification_id = (select max(v.id) from blueprint_verifications v where v.blueprint_id = b.id)
    where b.status = 'active' and b.source <> 'draft'`)
}

/** SQL fragments that flip one blueprint between "serving" and "not serving" without breaking the verification CHECKs. */
export const NOT_SERVING = `source = 'spec', serves_students = false, verification_id = null`
export const SERVING = `source = 'verified', serves_students = true,
  verification_id = (select max(v.id) from blueprint_verifications v where v.blueprint_id = blueprints.id)`

/**
 * The PoC export gives its blueprint sections no mark budget (null = the question count). The standard generator is
 * exact on marks (D75), so the PoC blueprints get the budgets of their seeded papers (mat-k2 9/6/6, sn-k2 9/4), which
 * the PoC pools can hit. Kertas 1 Matematik (10 questions of 1 mark) already fits.
 */
export async function setPocMarkBudgets(db: { query: (sql: string) => Promise<unknown> }): Promise<void> {
  const set = (code: string, label: string, budget: number): Promise<unknown> =>
    db.query(`update blueprint_sections set mark_budget = ${String(budget)}
        where label = '${label}' and blueprint_id = (select id from blueprints where code = '${code}' and status = 'active')`)
  await set('1449/2', 'Bahagian A', 9)
  await set('1449/2', 'Bahagian B', 6)
  await set('1449/2', 'Bahagian C', 6)
  await set('4541/2', 'Bahagian A', 9)
  await set('4541/2', 'Bahagian B', 4)
}
