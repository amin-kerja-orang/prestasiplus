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
