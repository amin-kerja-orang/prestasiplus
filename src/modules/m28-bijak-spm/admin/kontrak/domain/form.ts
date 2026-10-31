/**
 * Editor form model of the Kontrak Blueprint (BJS-F1). The server view (`BijakBlueprintView`) is
 * turned into plain editable values (numbers may be empty while typing) and back into the write
 * body. The write body is built field by field: the view carries read-only fields (`reviewed`,
 * `kbatReviewed`, `position`, `servesStudents`, ...) that a write must never send (strict schema).
 */
import type {
  BijakBlueprintAdminVersionInput,
  BijakBlueprintView,
  BijakQuotaTag,
  BijakUnitRefView,
} from '@pp/contract'

export type SourceTag = 'Draf' | 'Spec' | 'Disahkan'
export type ProfileKind = 'ladder' | 'bahagian' | 'tema'
export type QuotaBasis = 'questions' | 'marks'

export interface FormGroup {
  from: number | null
  to: number | null
  tpMin: number
  tpMax: number
  /** Exact count per TP (key = TP 1..6). Empty = not set. */
  tpCounts: Record<number, number | null>
  /** Exact marks per question of the group (per-slot marks); null = not set. */
  marks: number | null
  /** `tema` blocks keep their unit set untouched (the option is hidden, design D-9). */
  units?: BijakUnitRefView[]
}

export interface FormQuotaLine {
  unit: BijakUnitRefView
  value: number | null
  tag?: BijakQuotaTag
  /** Read-only (server): false = "Belum disemak". */
  reviewed: boolean
}

export interface FormSection {
  uid: string
  label: string
  instruction: string
  compulsory: boolean
  pool: string | null
  ruleType: 'all' | 'choose'
  chooseN: number | null
  questionCount: number | null
  markBudget: number | null
  allowedModes: string[]
  profileKind: ProfileKind | null
  groups: FormGroup[]
  perSlotMarks: boolean
  quotaBasis: QuotaBasis
  quotaLines: FormQuotaLine[]
  levelShare: { t4: number | null; t5: number | null }
  kbatMarks: number | null
  /** Read-only (server): false = the KBAT value is "Belum disemak". */
  kbatReviewed: boolean
}

export interface ContractForm {
  code: string
  durationMin: number | null
  totalMarks: number | null
  /** The status the author can pick (Draf or Spec); a Disahkan head is shown, never written. */
  source: SourceTag
  notes: string
  /** One cover instruction per line. */
  instructions: string
  subPartRamp: boolean
  /** "Boleh tanda auto" (V2 auto_markable); null = not stated. Cosmetic: never resets Disahkan. */
  autoMarkable: boolean | null
  kbatMarks: number | null
  levelShare: { t4: number | null; t5: number | null }
  sections: FormSection[]
}

let seq = 0
export const newUid = (): string => `s${Date.now().toString(36)}${(seq += 1)}`

export function emptyGroup(from: number | null, to: number | null): FormGroup {
  return { from, to, tpMin: 1, tpMax: 6, tpCounts: {}, marks: null }
}

export function emptySection(label: string): FormSection {
  return {
    uid: newUid(),
    label,
    instruction: '',
    compulsory: false,
    pool: null,
    ruleType: 'all',
    chooseN: null,
    questionCount: null,
    markBudget: null,
    allowedModes: [],
    profileKind: null,
    groups: [],
    perSlotMarks: false,
    quotaBasis: 'questions',
    quotaLines: [],
    levelShare: { t4: null, t5: null },
    kbatMarks: null,
    kbatReviewed: true,
  }
}

export function emptyForm(): ContractForm {
  return {
    code: '',
    durationMin: null,
    totalMarks: null,
    source: 'Draf',
    notes: '',
    instructions: '',
    subPartRamp: false,
    autoMarkable: null,
    kbatMarks: null,
    levelShare: { t4: null, t5: null },
    sections: [emptySection('Bahagian A')],
  }
}

export function formFromView(v: BijakBlueprintView): ContractForm {
  return {
    code: v.code,
    durationMin: v.durationMin,
    totalMarks: v.totalMarks,
    source: v.source,
    notes: v.notes ?? '',
    instructions: v.instructions.join('\n'),
    subPartRamp: v.subPartRamp,
    autoMarkable: v.autoMarkable ?? null,
    kbatMarks: v.kbatMarks,
    levelShare: { t4: v.levelShare?.t4 ?? null, t5: v.levelShare?.t5 ?? null },
    sections: [...v.sections]
      .sort((a, b) => a.position - b.position)
      .map((s) => {
        const groups: FormGroup[] = (s.profile?.groups ?? []).map((g) => {
          const tpCounts: Record<number, number | null> = {}
          for (const c of g.tpCounts ?? []) tpCounts[c.tp] = c.count
          return {
            from: g.from,
            to: g.to,
            tpMin: g.tpMin,
            tpMax: g.tpMax,
            tpCounts,
            marks: g.marksMin !== undefined && g.marksMin === g.marksMax ? g.marksMin : null,
            ...(g.units ? { units: g.units } : {}),
          }
        })
        return {
          uid: newUid(),
          label: s.label,
          instruction: s.instruction,
          compulsory: s.compulsory,
          pool: s.pool,
          ruleType: s.rule.type,
          chooseN: s.rule.type === 'choose' ? s.rule.n : null,
          questionCount: s.questionCount,
          markBudget: s.markBudget,
          allowedModes: [...s.allowedModes],
          profileKind: s.profile?.kind ?? null,
          groups,
          perSlotMarks: groups.some((g) => g.marks !== null),
          quotaBasis: s.quota?.basis ?? 'questions',
          quotaLines: (s.quota?.lines ?? []).map((l) => ({
            unit: l.unit,
            value: l.value,
            ...(l.tag ? { tag: l.tag } : {}),
            reviewed: l.reviewed,
          })),
          levelShare: { t4: s.quota?.levelShare?.t4 ?? null, t5: s.quota?.levelShare?.t5 ?? null },
          kbatMarks: s.kbatMarks,
          kbatReviewed: s.kbatReviewed,
        }
      }),
  }
}

/** The unit reference as written: ids only, no display fields. */
export function unitRefOf(u: BijakUnitRefView): { kind: 'unit'; nodeId: string } | { kind: 't1_t3' } {
  return u.kind === 'unit' ? { kind: 'unit', nodeId: u.nodeId } : { kind: 't1_t3' }
}

const int = (n: number | null): number => (n === null || Number.isNaN(n) ? 0 : Math.trunc(n))

/** The write body (`POST .../versions` and `POST /admin/blueprints`), built explicitly. */
export function toInput(f: ContractForm): BijakBlueprintAdminVersionInput {
  const lines = f.instructions
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const out: BijakBlueprintAdminVersionInput = {
    code: f.code.trim(),
    durationMin: int(f.durationMin),
    instructions: lines,
    notes: f.notes.trim() ? f.notes.trim() : null,
    subPartRamp: f.subPartRamp,
    autoMarkable: f.autoMarkable,
    kbatMarks: f.kbatMarks,
    levelShare:
      f.levelShare.t4 !== null && f.levelShare.t5 !== null
        ? { t4: f.levelShare.t4, t5: f.levelShare.t5 }
        : null,
    sections: f.sections.map((s) => {
      const groups = s.profileKind
        ? s.groups.map((g) => {
            const counts = Object.entries(g.tpCounts)
              .filter(([, c]) => c !== null && c !== undefined && c > 0)
              .map(([tp, c]) => ({ tp: Number(tp), count: int(c as number) }))
            const marked = s.perSlotMarks && g.marks !== null
            return {
              from: int(g.from),
              to: int(g.to),
              tpMin: g.tpMin,
              tpMax: g.tpMax,
              ...(counts.length ? { tpCounts: counts } : {}),
              ...(marked ? { marksMin: int(g.marks), marksMax: int(g.marks) } : {}),
              ...(g.units ? { units: g.units.map(unitRefOf) } : {}),
            }
          })
        : []
      return {
        label: s.label.trim(),
        markBudget: int(s.markBudget),
        questionCount: int(s.questionCount),
        compulsory: s.compulsory,
        ...(s.instruction.trim() ? { instruction: s.instruction.trim() } : {}),
        rule: s.ruleType === 'all' ? { type: 'all' as const } : { type: 'choose' as const, n: int(s.chooseN) },
        ...(s.pool ? { pool: s.pool } : {}),
        profile: s.profileKind && groups.length ? { kind: s.profileKind, groups } : null,
        quota: s.quotaLines.length
          ? {
              basis: s.quotaBasis,
              lines: s.quotaLines.map((l) => ({
                ...(l.tag ? { tag: l.tag } : {}),
                unit: unitRefOf(l.unit),
                value: int(l.value),
              })),
              ...(s.levelShare.t4 !== null && s.levelShare.t5 !== null
                ? { levelShare: { t4: s.levelShare.t4, t5: s.levelShare.t5 } }
                : {}),
            }
          : null,
        kbatMarks: s.kbatMarks,
        allowedModes: s.allowedModes as BijakBlueprintAdminVersionInput['sections'][number]['allowedModes'],
      }
    }),
  }
  // The author picks Draf or Spec; a Disahkan head leaves `source` out and the server decides
  // (cosmetic edit keeps Disahkan, a structural edit makes a Spec version, AC-39.4).
  if (f.source !== 'Disahkan') out.source = f.source
  const total = f.totalMarks
  if (total !== null) out.totalMarks = total
  return out
}

/**
 * Structural fingerprint of a write body (AC-39.4): cosmetic fields (note, cover and section
 * instructions, section label) are left out. Equal fingerprints = a cosmetic edit.
 */
export function structuralKey(input: BijakBlueprintAdminVersionInput): string {
  const { notes: _n, instructions: _i, source: _s, sections, ...rest } = input
  void _n
  void _i
  void _s
  return JSON.stringify({
    ...rest,
    sections: sections.map(({ label: _l, instruction: _in, ...sec }) => {
      void _l
      void _in
      return sec
    }),
  })
}

export const groupSize = (g: FormGroup): number =>
  g.from !== null && g.to !== null && g.to >= g.from ? g.to - g.from + 1 : 0

/** Section marks offered to the student (before choose-N), or null when it is not defined (D-7). */
export function offeredMarks(s: FormSection): number | null {
  if (s.markBudget === null) return null
  if (s.ruleType === 'all') return s.markBudget
  const n = s.chooseN
  const m = s.questionCount
  if (!n || !m) return null
  if (s.perSlotMarks) {
    let sum = 0
    for (const g of s.groups) {
      if (g.marks === null) return null
      sum += g.marks * groupSize(g)
    }
    return sum
  }
  return s.markBudget % n === 0 ? (s.markBudget / n) * m : null
}

/** Range text of a section, continuous numbering across sections (AC-34.5). */
export function questionRange(sections: readonly FormSection[], index: number): string {
  let start = 1
  for (let i = 0; i < index; i += 1) start += sections[i]?.questionCount ?? 0
  const count = sections[index]?.questionCount ?? 0
  if (count < 1) return 'Soalan belum ditetapkan'
  return count === 1 ? `Soalan ${start}` : `Soalan ${start} - ${start + count - 1}`
}

export function unitLabel(u: BijakUnitRefView): string {
  if (u.kind === 't1_t3') return 'T1-T3, luar DSKP'
  return [u.level, u.code, u.title].filter(Boolean).join(' ') || u.nodeId
}

export function unitKey(u: BijakUnitRefView): string {
  return u.kind === 't1_t3' ? 't1_t3' : u.nodeId
}
