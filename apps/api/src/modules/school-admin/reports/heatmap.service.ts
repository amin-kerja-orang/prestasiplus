import { Inject, Injectable } from '@nestjs/common'
import type { SchoolAdminDskpHeatmap, SchoolAdminHeatmapBidang } from '@pp/contract'

import { idToString } from '../../../db/ids'
import { CurriculumRepository } from '../../curriculum'
import type { CurriculumNode } from '../../curriculum/curriculum.repository'
import { SchoolPopulation } from './population'
import { dskpStatusOf, HEATMAP_LEVELS, pooledPct, tingkatanOf, type HeatmapLevel } from './windows'

/** T1 to T5 are the M03 levels of grade 7 to 11 (XS-1: `users.grade` 7..11). */
const GRADE_OF = { t1: 7, t2: 8, t3: 9, t4: 10, t5: 11 } as const
const NAME_OF = { t1: 'Tingkatan 1', t2: 'Tingkatan 2', t3: 'Tingkatan 3', t4: 'Tingkatan 4', t5: 'Tingkatan 5' } as const
const NUMBER_OF = { t1: 1, t2: 2, t3: 3, t4: 4, t5: 5 } as const

const byName = (a: { name: string }, b: { name: string }): number => a.name.localeCompare(b.name, 'ms', { sensitivity: 'base' })

/**
 * S2 DSKP heatmap (mock `heatmap`), levels T1 to T5. The structure is the real DSKP tree of BE-08 (`curriculum_nodes`: grouping = bidang, with the
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
    const school = await this.population.school(schoolId)
    // FR-AS-47-1: only the levels that have content are offered; the default is the highest of them (T4 when none has any).
    const content = new Map<HeatmapLevel, { withSp: { id: string; name: string; key: bigint }[]; bySubject: Map<bigint, CurriculumNode[]> }>()
    for (const code of HEATMAP_LEVELS) {
      const lvl = await this.curriculum.levelForGrade(GRADE_OF[code])
      if (!lvl) continue
      const nodes = await this.curriculum.dskpNodes(lvl.id)
      const bySubject = new Map<bigint, CurriculumNode[]>()
      for (const n of nodes) bySubject.set(n.subjectId, [...(bySubject.get(n.subjectId) ?? []), n])
      const active = await this.curriculum.subjects({ active: true, educationLevelId: lvl.id })
      const withSp = active
        .filter((s) => (bySubject.get(s.id) ?? []).some((n) => n.kind === 'sp'))
        .map((s) => ({ id: idToString(s.id), name: s.name, key: s.id }))
        .sort(byName)
      if (withSp.length > 0) content.set(code, { withSp, bySubject })
    }
    const offered = HEATMAP_LEVELS.filter((c) => content.has(c))
    const asked = tingkatanOf(query.tingkatan)
    const code: HeatmapLevel = asked !== null && offered.includes(asked) ? asked : (offered.at(-1) ?? 't4')
    const level = { code, name: NAME_OF[code] }
    const levels = offered.map((c) => ({ code: c, name: NAME_OF[c] }))
    const empty: SchoolAdminDskpHeatmap = { school, subjects: [], subject: null, level, levels, caption: null, bidang: [] }
    const here = content.get(code)
    if (!here) return empty
    const { withSp, bySubject } = here
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
      levels,
      caption: `KSSM ${chosen.name} Tingkatan ${NUMBER_OF[code]}`,
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
