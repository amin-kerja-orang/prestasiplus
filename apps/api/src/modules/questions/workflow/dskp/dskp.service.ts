import { Inject, Injectable } from '@nestjs/common'
import type { z } from 'zod'
import type { GuruDskpBidangListSchema, GuruDskpSkListSchema, GuruDskpSpListSchema } from '@pp/contract'

import { idFromString, idToString, isIdString } from '../../../../db/ids'
import { PrismaService } from '../../../../db/prisma.service'
import { CurriculumRepository } from '../../../curriculum'

type GuruDskpBidangList = z.infer<typeof GuruDskpBidangListSchema>
type GuruDskpSkList = z.infer<typeof GuruDskpSkListSchema>
type GuruDskpSpList = z.infer<typeof GuruDskpSpListSchema>

/**
 * DSKP picking lists of the teacher's question form (catalogue M04-28 to 30). Read-only.
 *
 * Working assumption (BE-10): the `dskp_bidang/sk/sp` tables belong to BE-18 and do not exist yet, so
 * the lists are read from the curriculum module's DSKP node tree (BE-08): Bidang = a `grouping` node of
 * the subject and level, Standard Kandungan = the `sk` nodes under the units of that grouping,
 * Standard Pembelajaran = the `sp` nodes under an `sk`. Ids are the curriculum node ids. A grouping
 * has no printed code, so `code` is null. When BE-18 lands, only this class changes.
 */
@Injectable()
export class DskpService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
  ) {}

  async bidang(subjectId: unknown, educationLevelId: unknown): Promise<GuruDskpBidangList> {
    if (!isId(subjectId) || !isId(educationLevelId)) return []
    const rows = await this.prisma.client.curriculumNode.findMany({
      where: { kind: 'grouping', subjectId: idFromString(subjectId), educationLevelId: idFromString(educationLevelId) },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    })
    return rows.map((r) => ({ id: idToString(r.id), code: null, name: r.title }))
  }

  async sk(bidangId: unknown): Promise<GuruDskpSkList> {
    if (!isId(bidangId)) return []
    const grouping = await this.curriculum.nodeById(idFromString(bidangId))
    if (grouping?.kind !== 'grouping') return []
    const out: GuruDskpSkList = []
    for (const unit of await this.curriculum.childrenOf(grouping.id)) {
      if (unit.kind !== 'unit') continue
      for (const sk of await this.curriculum.childrenOf(unit.id)) {
        if (sk.kind === 'sk') out.push({ id: idToString(sk.id), code: sk.code, description: sk.title })
      }
    }
    return out
  }

  async sp(skId: unknown): Promise<GuruDskpSpList> {
    if (!isId(skId)) return []
    const sk = await this.curriculum.nodeById(idFromString(skId))
    if (sk?.kind !== 'sk') return []
    return (await this.curriculum.childrenOf(sk.id))
      .filter((n) => n.kind === 'sp')
      .map((n) => ({ id: idToString(n.id), code: n.code, description: n.title }))
  }
}

function isId(v: unknown): v is string {
  return typeof v === 'string' && isIdString(v)
}
