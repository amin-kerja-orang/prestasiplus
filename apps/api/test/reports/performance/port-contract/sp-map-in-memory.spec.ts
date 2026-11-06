import type { SpNodeRef, SpSubjectTree } from '../../../../src/modules/reports/performance/ports'
import { InMemorySpMap } from '../fakes/in-memory-sp-map'
import { describeSpMapPort, type SpMapSeed, type SpMapSeedNode } from './sp-map.contract'

/** Builds the fake's per-level trees the way the SQL adapter reads `curriculum_nodes`: depth-first by (sortOrder, id). */
function treesOf(seed: SpMapSeed, levelId: string): SpSubjectTree[] {
  const nodes = seed.nodes.filter((n) => n.levelId === levelId)
  const byOrder = (a: SpMapSeedNode, b: SpMapSeedNode): number => a.sortOrder - b.sortOrder || Number(a.id) - Number(b.id)
  const out: SpSubjectTree[] = []
  for (const s of [...seed.subjects].filter((x) => x.isActive).sort((a, b) => a.sortOrder - b.sortOrder || Number(a.id) - Number(b.id))) {
    const own = nodes.filter((n) => n.subjectId === s.id)
    const refs: SpNodeRef[] = []
    const walk = (parentId: string | null, unit: string | null, sk: string | null): void => {
      for (const n of own.filter((x) => x.parentId === parentId).sort(byOrder)) {
        const u = n.kind === 'unit' ? n.title : unit
        const k = n.kind === 'sk' ? n.title : sk
        if (n.kind === 'sp') refs.push({ spNodeId: n.id, code: n.code, title: n.title, strand: u ?? k, sortOrder: refs.length + 1 })
        walk(n.id, u, k)
      }
    }
    walk(null, null, null)
    if (refs.length > 0) out.push({ subjectId: s.id, subjectCode: s.code, subjectName: s.name, nodes: refs })
  }
  return out
}

describeSpMapPort('InMemorySpMap', async (seed) => {
  const port = new InMemorySpMap()
  for (const level of seed.levels) port.setTree(level, treesOf(seed, level))
  for (const q of seed.questions) {
    const approved = [...q.versions].reverse().find((v) => v.status === 'approved')
    if (approved && approved.spIds.length > 0) port.tag(q.id, ...approved.spIds)
  }
  return port
})
