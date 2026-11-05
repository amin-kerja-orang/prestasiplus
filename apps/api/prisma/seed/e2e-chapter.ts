import type { PrismaClient } from '../../src/db/client'

/** Questions per subject and level that `linkPracticeChapters` links to a chapter. */
export const E2E_CHAPTER_LINKS_PER_LEVEL = 10

/**
 * The demo bank carries no `chapter_id`, so no chapter has a question and "Soalan by Chapter" lists nothing (REQ-B-109 e2e). For each subject
 * and offered level (T1 fixture, T4, T5) the first 10 approved, ungrouped, non-PKSK MCQs (by version id, counted before the chapter filter so a re-run picks
 * the same ones) are linked to the first in-tree active chapter of that subject and level. Existing links are never changed. Idempotent: a
 * re-run updates nothing. Only called by the guarded e2e seed.
 */
export async function linkPracticeChapters(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRaw`
    update question_versions v set chapter_id = pick.chapter_id
      from (
        select v2.id,
               (select min(c.id) from chapters c
                 where c.subject_id = v2.subject_id and c.education_level_id = v2.education_level_id and c.in_tree and c.is_active) as chapter_id,
               row_number() over (partition by v2.subject_id, v2.education_level_id order by v2.id) as rn
          from question_versions v2
          join questions q on q.id = v2.question_id and v2.version_no = q.live_version_no
         where v2.status = 'approved' and v2.type = 'mcq' and q.is_active and q.group_id is null
           and not exists (select 1 from question_tags pt where pt.question_id = q.id and pt.kind = 'pksk_domain')
           and v2.education_level_id in (select id from education_levels where code in ('T1', 'T4', 'T5'))
      ) pick
     where v.id = pick.id and pick.rn <= ${E2E_CHAPTER_LINKS_PER_LEVEL} and pick.chapter_id is not null and v.chapter_id is null`
}
