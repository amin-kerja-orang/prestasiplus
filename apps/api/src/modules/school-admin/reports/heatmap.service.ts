import { Inject, Injectable } from '@nestjs/common'
import type { SchoolAdminDskpHeatmap, SchoolAdminHeatmapBidang } from '@pp/contract'

import { idToString } from '../../../db/ids'
import { CurriculumRepository } from '../../curriculum'
import type { CurriculumNode } from '../../curriculum/curriculum.repository'
import { SchoolPopulation } from './population'
import { dskpStatusOf, pooledPct, tingkatanOf } from './windows'

/** T4 and T5 are the M03 levels of grade 10 and 11. */
const GRADE_OF = { t4: 10, t5: 11 } as const
const NAME_OF = { t4: 'Tingkatan 4', t5: 'Tingkatan 5' } as const

const byName = (a: { name: string }, b: { name: string }): number => a.name.localeCompare(b.name, 'ms', { sensitivity: 'base' })

/**
 * S2 DSKP heatmap (mock `heatmap`). The structure is the real DSKP tree of BE-08 (`curriculum_nodes`: grouping = bidang, with the
 * sp nodes below its units and sks), the latest edition of each subject.
 *
 * Per-SP results are NOT available (BE-21 OQ-2, LEAD decision): a practice answer carries subject, chapter and topic but no SP id,
 * no owner maps a topic to an SP, and `chapters.dskp_code` is null in the seed. Attributing a pupil's chapter result to an SP would
 * be a guess, so every SP is `answered 0 / correct 0 / pct null / belum`. `pooledPct` and `dskpStatusOf` are ready (and unit
 * tested) for the day an owner exposes an SP link; the school's pooled figure would then also need the `K_COHORT` rule.
 */
@Injectable()
export class HeatmapService {
  constructor(
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
    @Inject(SchoolPopulation) private readonly population: SchoolPopulation,
  ) {}

  async heatmap(schoolId: string, query: { subjectId?: string | undefined; tingkatan?: string | undefined }): Promise<SchoolAdminDskpHeatmap> {
    const code = tingkatanOf(query.tingkatan)
    const school = await this.population.school(schoolId)
    const level = { code, name: NAME_OF[code] }
    const lvl = await this.curriculum.levelForGrade(GRADE_OF[code])
    const empty: SchoolAdminDskpHeatmap = { school, subjects: [], subject: null, level, caption: null, bidang: [] }
    if (!lvl) return empty

    const nodes = await this.curriculum.dskpNodes(lvl.id)
    const bySubject = new Map<bigint, CurriculumNode[]>()
    for (const n of nodes) bySubject.set(n.subjectId, [...(bySubject.get(n.subjectId) ?? []), n])

    const active = await this.curriculum.subjects({ active: true, educationLevelId: lvl.id })
    const withSp = active
      .filter((s) => (bySubject.get(s.id) ?? []).some((n) => n.kind === 'sp'))
      .map((s) => ({ id: idToString(s.id), name: s.name, key: s.id }))
      .sort(byName)
    const chosen = withSp.find((s) => s.id === query.subjectId) ?? withSp[0] ?? null
    if (!chosen) return empty

    const subjectNodes = latestEdition(bySubject.get(chosen.key) ?? [])
    const children = new Map<bigint, CurriculumNode[]>()
    for (const n of subjectNodes) if (n.parentId !== null) children.set(n.parentId, [...(children.get(n.parentId) ?? []), n])

    const bidang: SchoolAdminHeatmapBidang[] = []
    for (const g of subjectNodes.filter((n) => n.kind === 'grouping')) {
      const sp = spBelow(g.id, children).map((n) => ({
        id: idToString(n.id),
        code: n.code,
        title: n.title,
        answered: 0,
        correct: 0,
        pct: pooledPct(0, 0),
        status: dskpStatusOf(pooledPct(0, 0)),
      }))
      if (sp.length > 0) bidang.push({ id: idToString(g.id), code: null, name: g.title, sp })
    }

    return {
      school,
      subjects: withSp.map(({ id, name }) => ({ id, name })),
      subject: { id: chosen.id, name: chosen.name },
      level,
      caption: `KSSM ${chosen.name} Tingkatan ${code === 't4' ? 4 : 5}`,
      bidang,
    }
  }
}

/** The nodes of the edition with the greatest text (editions are year-like texts; nodes are versioned by edition). */
function latestEdition(nodes: CurriculumNode[]): CurriculumNode[] {
  const latest = nodes.reduce((max, n) => (n.edition > max ? n.edition : max), '')
  return nodes.filter((n) => n.edition === latest)
}

/** The sp nodes under a node, depth first in printed order. */
function spBelow(id: bigint, children: Map<bigint, CurriculumNode[]>): CurriculumNode[] {
  const out: CurriculumNode[] = []
  for (const c of children.get(id) ?? []) {
    if (c.kind === 'sp') out.push(c)
    else out.push(...spBelow(c.id, children))
  }
  return out
}
