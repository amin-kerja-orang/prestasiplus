/**
 * The six launch blueprints for the property suite: layer 1 (structure and profile, architecture 8) plus a
 * layer 2 read from the analyst files (fixtures/blueprints/*.json, copies of docs/reference/blueprints).
 * Unit codes are resolved to synthetic node ids; a value the analyst left out (INCOMPLETE KBAT) gets a
 * synthetic one so every section is fully constrained.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import type { UnitFact } from '../../src/eligibility'
import type {
  Profile,
  ProfileKind,
  QuotaLine,
  SectionRule,
  SlotGroup,
  StandardBlueprint,
  StandardSection,
  UnitKey,
} from '../../src/standard-model'
import { offeredMarks, unitKeyOf } from '../../src/standard-model'

interface L1Section {
  label: string
  questionCount: number
  markBudget: number
  rule: SectionRule
  kind: ProfileKind
  groups: SlotGroup[]
}

interface L1 {
  code: string
  subject: string
  kertas: number
  durationMin: number
  subPartRamp?: boolean
  sections: L1Section[]
}

const g = (from: number, to: number, tpMin: number, tpMax: number, marksMin?: number, marksMax?: number): SlotGroup => ({
  from,
  to,
  tpMin,
  tpMax,
  ...(marksMin !== undefined ? { marksMin } : {}),
  ...(marksMax !== undefined ? { marksMax } : {}),
})
const all: SectionRule = { type: 'all' }
const choose = (n: number): SectionRule => ({ type: 'choose', n })

const LAYER1: L1[] = [
  {
    code: '1449/1', subject: 'MATH', kertas: 1, durationMin: 90,
    sections: [{ label: 'Bahagian A', questionCount: 40, markBudget: 40, rule: all, kind: 'ladder', groups: [g(1, 10, 2, 4), g(11, 20, 2, 4), g(21, 30, 3, 5), g(31, 40, 3, 5)] }],
  },
  {
    code: '1449/2', subject: 'MATH', kertas: 2, durationMin: 150,
    sections: [
      { label: 'Bahagian A', questionCount: 10, markBudget: 40, rule: all, kind: 'bahagian', groups: [g(1, 10, 2, 4, 3, 5)] },
      { label: 'Bahagian B', questionCount: 5, markBudget: 45, rule: all, kind: 'bahagian', groups: [g(1, 5, 3, 5, 8, 10)] },
      { label: 'Bahagian C', questionCount: 2, markBudget: 15, rule: choose(1), kind: 'bahagian', groups: [g(1, 2, 3, 6, 15, 15)] },
    ],
  },
  {
    code: '3472/1', subject: 'ADDMATH', kertas: 1, durationMin: 120,
    sections: [
      { label: 'Bahagian A', questionCount: 12, markBudget: 64, rule: all, kind: 'bahagian', groups: [g(1, 12, 3, 5)] },
      { label: 'Bahagian B', questionCount: 3, markBudget: 16, rule: choose(2), kind: 'bahagian', groups: [g(1, 3, 4, 6, 8, 8)] },
    ],
  },
  {
    code: '3472/2', subject: 'ADDMATH', kertas: 2, durationMin: 150,
    sections: [
      { label: 'Bahagian A', questionCount: 7, markBudget: 50, rule: all, kind: 'bahagian', groups: [g(1, 7, 3, 5)] },
      { label: 'Bahagian B', questionCount: 4, markBudget: 30, rule: choose(3), kind: 'bahagian', groups: [g(1, 4, 4, 5)] },
      { label: 'Bahagian C', questionCount: 4, markBudget: 20, rule: choose(2), kind: 'bahagian', groups: [g(1, 4, 4, 6)] },
    ],
  },
  {
    code: '4531/2', subject: 'PHY', kertas: 2, durationMin: 150,
    sections: [
      { label: 'Bahagian A', questionCount: 8, markBudget: 60, rule: all, kind: 'ladder', groups: [g(1, 1, 2, 3, 4, 4), g(2, 2, 2, 3, 5, 5), g(3, 3, 2, 3, 6, 6), g(4, 4, 2, 3, 9, 9), g(5, 6, 3, 4, 9, 9), g(7, 8, 4, 4, 9, 9)] },
      { label: 'Bahagian B', questionCount: 2, markBudget: 20, rule: choose(1), kind: 'bahagian', groups: [g(1, 2, 5, 5, 20, 20)] },
      { label: 'Bahagian C', questionCount: 1, markBudget: 20, rule: all, kind: 'bahagian', groups: [g(1, 1, 5, 6, 20, 20)] },
    ],
  },
  {
    code: '1249/2', subject: 'SEJ', kertas: 2, durationMin: 90, subPartRamp: true,
    sections: [
      { label: 'Bahagian A', questionCount: 4, markBudget: 40, rule: all, kind: 'bahagian', groups: [g(1, 4, 2, 4, 10, 10)] },
      { label: 'Bahagian B', questionCount: 5, markBudget: 60, rule: choose(3), kind: 'bahagian', groups: [g(1, 5, 3, 5, 20, 20)] },
    ],
  },
]

interface L2Line {
  subject?: string
  level?: 'T4' | 'T5'
  unitCode?: string
  bucket?: 't1_t3'
  value: number
}
interface L2 {
  code: string
  sections: {
    position: number
    quota?: { basis: 'questions' | 'marks'; lines: L2Line[]; levelShare?: { t4: number; t5: number } }
    kbatMarks?: number
    marksBand?: { from: number; to: number; marksMin: number; marksMax: number }[]
  }[]
}

export interface LaunchBlueprint {
  bp: StandardBlueprint
  /** Synthetic unit facts by unit key (those with a quota line). */
  units: Map<UnitKey, UnitFact>
}

function readLayer2(code: string): L2 {
  const file = new URL(`../fixtures/blueprints/${code.replace('/', '-')}.json`, import.meta.url)
  return JSON.parse(readFileSync(fileURLToPath(file), 'utf8')) as L2
}

export function launchBlueprints(): LaunchBlueprint[] {
  return LAYER1.map((l1) => {
    const l2 = readLayer2(l1.code)
    const units = new Map<UnitKey, UnitFact>()
    const sections: StandardSection[] = l1.sections.map((s1, i) => {
      const position = i + 1
      const f = l2.sections.find((x) => x.position === position)
      let groups = s1.groups.map((x) => ({ ...x }))
      if (f?.marksBand) {
        groups = groups.map((grp) => {
          const band = f.marksBand!.find((b) => b.from <= grp.from && b.to >= grp.to)
          return band ? { ...grp, marksMin: band.marksMin, marksMax: band.marksMax } : grp
        })
      }
      const profile: Profile = { kind: s1.kind, groups }
      const lines: QuotaLine[] = (f?.quota?.lines ?? []).map((ln) => {
        if (ln.bucket) return { unit: { kind: 't1_t3' as const }, value: ln.value }
        const nodeId = `${ln.subject}:${ln.level}:${ln.unitCode}`
        const ref = { kind: 'unit' as const, nodeId }
        units.set(unitKeyOf(ref), { nodeId, level: ln.level!, code: ln.unitCode! })
        return { unit: ref, value: ln.value }
      })
      const section: StandardSection = {
        position,
        label: s1.label,
        rule: s1.rule,
        questionCount: s1.questionCount,
        markBudget: s1.markBudget,
        allowedModes: [],
        profile,
        quota: f?.quota ? { basis: f.quota.basis, lines, ...(f.quota.levelShare ? { levelShare: f.quota.levelShare } : {}) } : null,
        kbatMarks: f?.kbatMarks ?? null,
      }
      // INCOMPLETE in the analyst file: give the section a synthetic exact KBAT value.
      if (section.kbatMarks === null) section.kbatMarks = Math.floor(0.75 * offeredMarks(section))
      return section
    })
    const bp: StandardBlueprint = {
      subject: l1.subject,
      kertas: l1.kertas,
      code: l1.code,
      version: 1,
      durationMin: l1.durationMin,
      sections,
      subPartRamp: l1.subPartRamp ?? false,
      kbatMarks: sections.reduce((n, s) => n + (s.kbatMarks ?? 0), 0),
    }
    return { bp, units }
  })
}
