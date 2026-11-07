import { curriculumCodeOf } from '../../src/modules/bijak/papers/subject-codes'
import type { TestDatabase } from './db'

/**
 * Fixture for a private `jana` paper. The pupil route that used to create one (`POST /api/bijak/papers/generate`) is
 * removed (S3-T07), so a test that needs a paper generated for a user clones the structure of the seeded curated
 * (published `pilihan`) paper of the same subject and kertas into a published `jana` row owned by that user.
 * Subject is the Bijak code (MAT, SN). Returns the new paper id.
 */
export async function seedJanaPaper(
  db: TestDatabase,
  o: { userId: string; subject: string; kertas: number; isTest?: boolean },
): Promise<string> {
  const code = curriculumCodeOf(o.subject)
  const src = (
    await db.query<{ id: string; name: string }>(
      `select p.id::text, s.name
         from papers p join subjects s on s.id = p.subject_id
        where p.kind = 'pilihan' and p.status = 'published' and s.code = $1 and p.kertas = $2
        order by p.id limit 1`,
      [code, o.kertas],
    )
  )[0]
  if (!src) throw new Error(`seedJanaPaper: no curated paper for ${o.subject} kertas ${String(o.kertas)}`)
  const previous = Number(
    (await db.query<{ n: string }>(`select count(*)::text n from papers where kind = 'jana' and generated_for_user_id = $1`, [o.userId]))[0]!.n,
  )
  const title = `Kertas Jana ${src.name} Kertas ${String(o.kertas)} (#${String(previous + 1)})`
  const paperId = (
    await db.query<{ id: string }>(
      `insert into papers (kind, title, subject_id, kertas, year, paper_code, printed_duration_min, instructions, reference_sheets,
                           blueprint_id, status, version, generated_for_user_id, is_test, published_at, created_by_id)
       select 'jana', $2, subject_id, kertas, year, paper_code, printed_duration_min, instructions, reference_sheets,
              blueprint_id, 'published', 1, $3::bigint, $4, now(), $3::bigint
         from papers where id = $1
       returning id::text`,
      [src.id, title, o.userId, o.isTest ?? false],
    )
  )[0]!.id
  const sections = await db.query<{ id: string; position: number }>(`select id::text, position from paper_sections where paper_id = $1 order by position`, [src.id])
  for (const s of sections) {
    const created = (
      await db.query<{ id: string }>(
        `insert into paper_sections (paper_id, position, label, title, instruction, rule_type, rule_n, question_count, mark_budget, compulsory)
         select $2::bigint, position, label, title, instruction, rule_type, rule_n, question_count, mark_budget, compulsory
           from paper_sections where id = $1 returning id::text`,
        [s.id, paperId],
      )
    )[0]!.id
    await db.query(
      `insert into paper_placements (paper_section_id, question_id, pinned_version_no, position)
       select $2::bigint, question_id, pinned_version_no, position from paper_placements where paper_section_id = $1`,
      [s.id, created],
    )
  }
  return paperId
}
