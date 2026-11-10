import type {
  KedudukanCandidate,
  KedudukanPool,
  KedudukanPort,
  KedudukanScope,
  KedudukanViewer,
} from '../../../../src/modules/reports/performance/ports'

export interface FakePupil extends KedudukanCandidate {
  schoolId: string | null
  state: string | null
  classIds: string[]
}

/**
 * In-memory `KedudukanPort` with the same contract as the SQL adapter: `higher` counts the pupils with a larger syiling and
 * `candidates` are the complete syiling groups of the viewer and of the two nearest pupils on each side.
 */
export class InMemoryKedudukan implements KedudukanPort {
  readonly pupils = new Map<string, FakePupil>()

  add(p: Partial<FakePupil> & { userId: string }): this {
    this.pupils.set(p.userId, { name: `Murid ${p.userId}`, syiling: 0, answered: 0, correct: 0, bestStreak: 0, schoolId: null, state: null, classIds: [], ...p })
    return this
  }

  async viewer(userId: string): Promise<KedudukanViewer | null> {
    const p = this.pupils.get(userId)
    if (!p) return null
    return { syiling: p.syiling, schoolId: p.schoolId, state: p.state, inClass: p.classIds.length > 0 }
  }

  async pool(userId: string, scope: KedudukanScope): Promise<KedudukanPool | null> {
    const me = this.pupils.get(userId)
    if (!me) return null
    const members = [...this.pupils.values()].filter((p) => {
      if (p.userId === userId) return true
      if (scope === 'kelas') return p.classIds.some((c) => me.classIds.includes(c))
      if (scope === 'sekolah') return me.schoolId !== null && p.schoolId === me.schoolId
      if (scope === 'negeri') return me.state !== null && p.state === me.state
      return true
    })
    const aboveSorted = members.filter((p) => p.syiling > me.syiling).map((p) => p.syiling).sort((a, b) => a - b)
    const belowSorted = members.filter((p) => p.syiling < me.syiling).map((p) => p.syiling).sort((a, b) => b - a)
    const hi = aboveSorted[1] ?? Number.MAX_SAFE_INTEGER
    const lo = belowSorted[1] ?? Number.MIN_SAFE_INTEGER
    return {
      total: members.length,
      higher: aboveSorted.length,
      candidates: members.filter((p) => p.syiling >= lo && p.syiling <= hi).map(({ schoolId, state, classIds, ...c }) => (void schoolId, void state, void classIds, c)),
    }
  }
}
