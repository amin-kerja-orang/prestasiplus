import { Inject, Injectable } from '@nestjs/common'
import type { StudioDskp } from '@pp/contract'

import { ApiError } from '../../../common/errors/api-error'
import { idFromString, idToString, isIdString } from '../../../db/ids'
import { CurriculumRepository } from '../../curriculum'

/**
 * The DSKP picker of the Studio (ADR-0031, R1-F03b): the units of one subject and level, each with its SP nodes (the SK code
 * kept as a hint). The question is tagged with a unit and 1 to 3 SP; TP and the cognitive level are chosen per leaf part. Read
 * only; the tree is the one `dskp:load` writes into `curriculum_nodes`.
 */
@Injectable()
export class StudioDskpService {
  constructor(@Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository) {}

  async units(subjectId: string, educationLevelId: string): Promise<StudioDskp> {
    if (!isIdString(subjectId) || !isIdString(educationLevelId)) {
      throw ApiError.of('VALIDATION_ERROR', { fields: { subjectId: 'Sila pilih subjek.', educationLevelId: 'Sila pilih tahap pendidikan.' } })
    }
    const nodes = await this.curriculum.dskpNodes(idFromString(educationLevelId), idFromString(subjectId))
    const byId = new Map(nodes.map((n) => [n.id, n]))
    // The newest edition wins when a unit exists in two editions: nodes are matched by printed code.
    const units = nodes.filter((n) => n.kind === 'unit')
    const sps = nodes.filter((n) => n.kind === 'sp')
    const seen = new Set<string>()
    const out: StudioDskp['units'] = []
    for (const unit of units) {
      if (seen.has(unit.code)) continue
      seen.add(unit.code)
      out.push({
        id: idToString(unit.id),
        code: unit.code,
        title: unit.title,
        sps: sps
          .filter((sp) => unitOf(sp.id, byId) === unit.id)
          .map((sp) => {
            const parent = sp.parentId === null ? undefined : byId.get(sp.parentId)
            return { id: idToString(sp.id), code: sp.code, title: sp.title, skCode: parent?.kind === 'sk' ? parent.code : null }
          }),
      })
    }
    return { units: out }
  }
}

/** The unit above a node (its SK's parent, or itself when it is the unit). */
function unitOf(id: bigint, byId: ReadonlyMap<bigint, { id: bigint; kind: string; parentId: bigint | null }>): bigint | null {
  let cur = byId.get(id)
  for (let depth = 0; cur && depth < 6; depth++) {
    if (cur.kind === 'unit') return cur.id
    cur = cur.parentId === null ? undefined : byId.get(cur.parentId)
  }
  return null
}
