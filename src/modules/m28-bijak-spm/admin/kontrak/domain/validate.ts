/**
 * Live "Semakan Kontrak" (BJS-F1, design 4.7 and 4.8): every problem of the editor form at once.
 * `error` blocks Save (AC-25.7); `incomplete` ("Belum lengkap") does not block Save (AC-35.1) but
 * blocks Sahkan; `warning` is informational (KBAT_TP_BAND, AC-37.5). The server repeats the check
 * (422 BLUEPRINT_INVALID) and its problems map onto the same issue shape (`issueFromProblem`).
 */
import { BIJAK_BUILDER_MESSAGES as MSG, type BijakBlueprintProblem } from '@pp/contract'

import {
  groupSize,
  offeredMarks,
  parseMarksList,
  unitLabel,
  type ContractForm,
  type FormSection,
} from './form'

export type IssueLevel = 'error' | 'incomplete' | 'warning'
export type SectionPart = 'struktur' | 'profil' | 'kuota' | 'kbat'

export interface Issue {
  id: string
  level: IssueLevel
  /** Contract code, or a client-only code (REQUIRED, QUOTA_EMPTY, QUOTA_BASIS, NO_*). */
  code: string
  /** 0-based index of the Bahagian, or null for a paper-level issue. */
  section: number | null
  part: SectionPart | 'umum'
  /** Element id to focus ("Pergi ke medan"). */
  target: string
  message: string
}

export const fieldId = (section: number | null, name: string): string =>
  section === null ? `kontrak-umum-${name}` : `kontrak-s${section}-${name}`

const labelOf = (s: FormSection, i: number): string => s.label.trim() || `Bahagian ${i + 1}`

/** Error copy, design 4.8 [PROPOSED]. */
export function problemMessage(
  code: string,
  ctx: { label?: string; a?: number; b?: number; x?: number; y?: number; unit?: string; c?: number; d?: number },
): string {
  const l = ctx.label ?? ''
  switch (code) {
    case 'TOTAL_MISMATCH':
      return `Jumlah markah (${ctx.y}) mesti sama dengan jumlah markah bahagian (${ctx.x}).`
    case 'CHOOSE_N_RANGE':
      return MSG.chooseNRange
    case 'COMPULSORY_CHOOSE':
      return MSG.compulsoryChoose
    case 'MARKS_PER_QUESTION':
      return MSG.marksPerQuestionMismatch
    case 'SLOT_OVERLAP':
      return `${l}: kumpulan slot bertindih pada slot ${ctx.a} - ${ctx.b}.`
    case 'SLOT_GAP':
      return `${l}: slot ${ctx.a} - ${ctx.b} belum dilitupi oleh mana-mana kumpulan.`
    case 'LADDER_DOWN':
      return `${l}: jalur TP tidak boleh menurun pada slot ${ctx.a}.`
    case 'TP_ORDER':
      return `${l}: TP minimum tidak boleh melebihi TP maksimum.`
    case 'TP_COUNTS':
      return `${l} slot ${ctx.a} - ${ctx.b}: jumlah kiraan TP (${ctx.x}) tidak sama dengan bilangan slot (${ctx.y}).`
    case 'PROFILE_SHAPE':
      return `${l}: bahagian pilih N mesti menggunakan satu kumpulan slot.`
    case 'PROFILE_SINGLE':
      return `${l}: profil Mengikut Bahagian menggunakan satu kumpulan slot.`
    case 'MARKS_BAND':
      return `${l}: jumlah markah slot (${ctx.x}) tidak sama dengan belanjawan bahagian (${ctx.y}).`
    case 'QUOTA_SUM':
      return `${l}: jumlah kuota topik (${ctx.x}) tidak sama dengan ${ctx.y} ${ctx.unit ?? 'soalan'} bahagian ini.`
    case 'QUOTA_UNIT':
      return `${l}: unit ${ctx.unit ?? ''} tidak boleh diulang dalam kuota topik.`
    case 'QUOTA_EMPTY':
      return `${l}: isi nilai untuk ${ctx.unit}.`
    case 'QUOTA_BASIS':
      return `${l}: Tetapkan markah mengikut slot atau kira dalam soalan.`
    case 'LEVEL_SHARE':
      return `${l}: nisbah Tingkatan 4 : 5 daripada nilai unit (${ctx.a} : ${ctx.b}) bercanggah dengan nisbah ditetapkan (${ctx.c} : ${ctx.d}).`
    case 'KBAT_RANGE':
      return `${l}: kuota KBAT (${ctx.x} markah) melebihi markah ditawarkan (${ctx.y}).`
    case 'KBAT_TOTAL':
      return `Kuota KBAT kertas (${ctx.x}) tidak sama dengan jumlah kuota KBAT bahagian (${ctx.y}).`
    case 'KBAT_TP_BAND':
      return `${l}: kuota KBAT ${ctx.x} markah bercanggah dengan jalur TP profil (${ctx.a} - ${ctx.b}).`
    case 'MODES':
      return `${l}: mod jawapan tidak sah.`
    case 'REQUIRED':
      return `${l}: ${ctx.unit ?? 'medan wajib'} diperlukan.`
    default:
      return `${l}: masalah kontrak (${code}).`
  }
}

export function incompleteMessage(code: string, label: string): string {
  switch (code) {
    case 'NO_PROFILE':
      return `${label}: profil kesukaran belum ditetapkan.`
    case 'NO_QUOTA':
      return `${label}: kuota topik belum ditetapkan.`
    case 'NO_KBAT':
      return `${label}: kuota KBAT belum diisi.`
    case 'NO_SHARE':
      return `${label}: nisbah Tingkatan 4 : 5 belum ditetapkan.`
    case 'NO_DURATION':
      return 'Tempoh kertas belum ditetapkan.'
    case 'NO_EVIDENCE_BODIES':
      return 'Bukti pengesahan daripada sekurang-kurangnya dua badan belum lengkap.'
    case 'UNREVIEWED':
      return `${label}: nilai masih Belum disemak.`
    default:
      return `${label}: belum lengkap (${code}).`
  }
}

/** Where a server problem lands in the editor. */
function partOf(code: string): SectionPart {
  if (['CHOOSE_N_RANGE', 'COMPULSORY_CHOOSE', 'MARKS_PER_QUESTION', 'MARKS_BAND', 'MODES', 'REQUIRED'].includes(code)) return 'struktur'
  if (['SLOT_OVERLAP', 'SLOT_GAP', 'PROFILE_SHAPE', 'PROFILE_SINGLE', 'TP_COUNTS', 'LADDER_DOWN', 'TP_ORDER'].includes(code))
    return 'profil'
  if (['KBAT_RANGE', 'KBAT_TP_BAND', 'KBAT_TOTAL'].includes(code)) return 'kbat'
  return 'kuota'
}

/** The field a section problem is about, when it is not the first one of its part. */
const FIELD_OF_CODE: Record<string, string> = { CHOOSE_N_RANGE: 'n', COMPULSORY_CHOOSE: 'compulsory', MARKS_PER_QUESTION: 'marks-list' }

const targetOf = (section: number | null, part: SectionPart | 'umum', code = ''): string =>
  section === null
    ? fieldId(null, part === 'kbat' ? 'kbat' : 'jumlah')
    : fieldId(section, FIELD_OF_CODE[code] ?? (part === 'struktur' ? 'label' : part))

export function issueFromProblem(
  p: BijakBlueprintProblem,
  sections: readonly FormSection[],
  level: IssueLevel = 'error',
): Issue {
  const idx = p.sectionPosition !== undefined ? p.sectionPosition - 1 : null
  const s = idx !== null ? sections[idx] : undefined
  const label = s && idx !== null ? labelOf(s, idx) : ''
  const code = p.code
  const message = problemMessage(code, {
    label,
    x: p.actual,
    y: p.expected,
    unit: p.unit ? unitLabel(p.unit) : undefined,
  })
  const part = idx === null ? ('umum' as const) : partOf(code)
  return {
    id: `srv-${code}-${idx ?? 'x'}-${p.groupIndex ?? 'x'}-${p.unit && p.unit.kind === 'unit' ? p.unit.nodeId : ''}`,
    level,
    code,
    section: idx,
    part,
    target: targetOf(idx, part, code),
    message,
  }
}

/** The screen field of a 422 `fields` key of the write body, when it has one. */
const FIELD_OF_KEY: Record<string, string> = { compulsory: 'compulsory', 'rule.n': 'n', marksPerQuestion: 'marks-list', markBudget: 'budget', questionCount: 'm', label: 'label', instruction: 'instruction' }
const PAPER_FIELD_OF_KEY: Record<string, string> = { subject: 'subject', code: 'code', durationMin: 'duration', totalMarks: 'jumlah', questionCount: 'question-count', notes: 'notes' }

/**
 * A 422 VALIDATION_ERROR of a write (`error.fields`: `subject`, `sections.N.compulsory`, `sections.N.rule.n`, ...) on the issue shape, so
 * the save summary shows each refusal with a link to its field. N is the 0-based index of the body's `sections`.
 */
export function issuesFromFields(fields: Readonly<Record<string, string>>): Issue[] {
  return Object.entries(fields).map(([key, message]) => {
    const m = /^sections\.(\d+)\.(.+)$/.exec(key)
    const section = m ? Number(m[1]) : null
    const name = m ? (FIELD_OF_KEY[m[2]!.replace(/\.\d+$/, '')] ?? 'label') : (PAPER_FIELD_OF_KEY[key] ?? 'jumlah')
    return { id: `fld-${key}`, level: 'error', code: 'VALIDATION_ERROR', section, part: section === null ? 'umum' : 'struktur', target: fieldId(section, name), message }
  })
}

/** Derived T4 : T5 split of a section's quota lines (T1-T3 bucket excluded). */
export function derivedShare(s: FormSection): { t4: number; t5: number } {
  let t4 = 0
  let t5 = 0
  for (const l of s.quotaLines) {
    if (l.unit.kind !== 'unit') continue
    if (l.unit.level === 'T4') t4 += l.value ?? 0
    else if (l.unit.level === 'T5') t5 += l.value ?? 0
  }
  return { t4, t5 }
}

const sameRatio = (a: { t4: number; t5: number }, b: { t4: number; t5: number }): boolean =>
  a.t4 * b.t5 === a.t5 * b.t4

export interface QuotaSum {
  sum: number
  target: number | null
  basis: 'questions' | 'marks'
}

export function quotaSum(s: FormSection): QuotaSum {
  const sum = s.quotaLines.reduce((n, l) => n + (l.value ?? 0), 0)
  const target = s.quotaBasis === 'questions' ? s.questionCount : offeredMarks(s)
  return { sum, target, basis: s.quotaBasis }
}

const INSTRUCTION_MAX = 500
const MARK_BUDGET_MAX = 1000
const CODE_MAX = 32
const DURATION_MAX = 600
const PAPER_QUESTIONS_MAX = 200

function sectionIssues(f: ContractForm, i: number): Issue[] {
  const s = f.sections[i]!
  const label = labelOf(s, i)
  const out: Issue[] = []
  const push = (
    level: IssueLevel,
    code: string,
    part: SectionPart,
    target: string,
    message: string,
    key = '',
  ): void => {
    out.push({ id: `${code}-${i}-${key}`, level, code, section: i, part, target, message })
  }

  // --- Struktur
  if (!s.label.trim()) push('error', 'REQUIRED', 'struktur', fieldId(i, 'label'), 'Label bahagian diperlukan.')
  if (s.instruction.trim().length > INSTRUCTION_MAX)
    push('error', 'INSTRUCTION_LENGTH', 'struktur', fieldId(i, 'instruction'), 'Arahan tidak boleh melebihi 500 aksara.')
  const m = s.questionCount
  if (m === null || m < 1)
    push('error', 'REQUIRED', 'struktur', fieldId(i, 'm'), problemMessage('REQUIRED', { label, unit: 'Bilangan soalan' }))
  if (s.markBudget === null || s.markBudget < 0 || s.markBudget > MARK_BUDGET_MAX)
    push('error', 'REQUIRED', 'struktur', fieldId(i, 'budget'), 'Markah tidak sah.')
  if (s.ruleType === 'choose') {
    const n = s.chooseN
    if (n === null || n < 1 || (m !== null && m < n))
      push('error', 'CHOOSE_N_RANGE', 'struktur', fieldId(i, 'n'), problemMessage('CHOOSE_N_RANGE', {}))
    // FR-QA-41: `Wajib dijawab` and `Pilih N` exclude each other.
    if (s.compulsory) push('error', 'COMPULSORY_CHOOSE', 'struktur', fieldId(i, 'compulsory'), problemMessage('COMPULSORY_CHOOSE', {}))
  }
  // 16-18: one mark per offered question, so a Pilih N list adds up to the marks offered, not the budget (exam-core `sectionProblems`).
  const marks = parseMarksList(s.marksPerQuestion, m)
  if (marks !== null) {
    const offered = offeredMarks(s)
    const wrong =
      marks === 'invalid' ||
      (m !== null && m >= 1 && marks.length !== m) ||
      (offered !== null && marks.reduce((sum, mark) => sum + mark, 0) !== offered)
    if (wrong) push('error', 'MARKS_PER_QUESTION', 'struktur', fieldId(i, 'marks-list'), problemMessage('MARKS_PER_QUESTION', {}))
  }

  // --- Profil
  const size = m ?? 0
  if (s.profileKind) {
    const groups = s.groups
    const ordered = groups
      .map((g, gi) => ({ g, gi }))
      .sort((a, b) => (a.g.from ?? 0) - (b.g.from ?? 0))
    if (s.profileKind === 'bahagian' && groups.length !== 1)
      push('error', 'PROFILE_SINGLE', 'profil', fieldId(i, 'profil'), problemMessage('PROFILE_SINGLE', { label }))
    if (s.ruleType === 'choose' && groups.length > 1)
      push('error', 'PROFILE_SHAPE', 'profil', fieldId(i, 'profil'), problemMessage('PROFILE_SHAPE', { label }))
    let cur = 1
    for (const { g } of ordered) {
      if (g.from === null || g.to === null || g.to < g.from) {
        push('error', 'REQUIRED', 'profil', fieldId(i, 'profil'), problemMessage('REQUIRED', { label, unit: 'Julat slot kumpulan' }), `r${g.from}`)
        continue
      }
      if (g.from < cur)
        push('error', 'SLOT_OVERLAP', 'profil', fieldId(i, 'profil'), problemMessage('SLOT_OVERLAP', { label, a: g.from, b: Math.min(cur - 1, g.to) }), `o${g.from}`)
      else if (g.from > cur)
        push('error', 'SLOT_GAP', 'profil', fieldId(i, 'profil'), problemMessage('SLOT_GAP', { label, a: cur, b: g.from - 1 }), `g${g.from}`)
      cur = Math.max(cur, g.to + 1)
    }
    if (size > 0 && cur <= size)
      push('error', 'SLOT_GAP', 'profil', fieldId(i, 'profil'), problemMessage('SLOT_GAP', { label, a: cur, b: size }), 'end')
    if (size > 0 && cur - 1 > size)
      push('error', 'SLOT_OVERLAP', 'profil', fieldId(i, 'profil'), problemMessage('SLOT_OVERLAP', { label, a: size + 1, b: cur - 1 }), 'over')

    groups.forEach((g, gi) => {
      if (g.tpMin > g.tpMax)
        push('error', 'TP_ORDER', 'profil', fieldId(i, `g${gi}-tpmin`), problemMessage('TP_ORDER', { label }), `t${gi}`)
      const set = Object.entries(g.tpCounts).filter(([, c]) => c !== null && c !== undefined)
      if (set.length > 0 && g.from !== null && g.to !== null) {
        const total = set.reduce((n, [, c]) => n + (c as number), 0)
        if (total !== groupSize(g))
          push('error', 'TP_COUNTS', 'profil', fieldId(i, `g${gi}-counts`), problemMessage('TP_COUNTS', { label, a: g.from, b: g.to, x: total, y: groupSize(g) }), `c${gi}`)
      }
    })
    if (s.profileKind === 'ladder') {
      for (let k = 1; k < ordered.length; k += 1) {
        const prev = ordered[k - 1]!.g
        const g = ordered[k]!.g
        if (g.tpMin < prev.tpMin || g.tpMax < prev.tpMax)
          push('error', 'LADDER_DOWN', 'profil', fieldId(i, `g${ordered[k]!.gi}-tpmin`), problemMessage('LADDER_DOWN', { label, a: g.from ?? 0 }), `l${k}`)
      }
    }
    if (s.perSlotMarks) {
      const missing = groups.some((g) => g.marks === null)
      if (missing) {
        push('error', 'REQUIRED', 'struktur', fieldId(i, 'profil'), problemMessage('REQUIRED', { label, unit: 'Markah setiap soalan' }), 'pm')
      } else if (s.markBudget !== null) {
        if (s.ruleType === 'choose') {
          const n = s.chooseN ?? 0
          const v = groups[0]?.marks ?? 0
          const same = groups.every((g) => g.marks === v)
          if (!same || v * n !== s.markBudget)
            push('error', 'MARKS_BAND', 'struktur', fieldId(i, 'profil'), problemMessage('MARKS_BAND', { label, x: v * n, y: s.markBudget }), 'mb')
        } else {
          const total = groups.reduce((n, g) => n + (g.marks ?? 0) * groupSize(g), 0)
          if (total !== s.markBudget)
            push('error', 'MARKS_BAND', 'struktur', fieldId(i, 'profil'), problemMessage('MARKS_BAND', { label, x: total, y: s.markBudget }), 'mb')
        }
      }
    }
  } else {
    push('incomplete', 'NO_PROFILE', 'profil', fieldId(i, 'profil'), incompleteMessage('NO_PROFILE', label))
  }

  // --- Kuota topik
  if (s.quotaLines.length > 0) {
    const seen = new Set<string>()
    for (const l of s.quotaLines) {
      const key = l.unit.kind === 't1_t3' ? 't1_t3' : l.unit.nodeId
      if (seen.has(key))
        push('error', 'QUOTA_UNIT', 'kuota', fieldId(i, 'kuota'), problemMessage('QUOTA_UNIT', { label, unit: unitLabel(l.unit) }), `d${key}`)
      seen.add(key)
      if (l.value === null)
        push('error', 'QUOTA_EMPTY', 'kuota', fieldId(i, `q-${key}`), problemMessage('QUOTA_EMPTY', { label, unit: unitLabel(l.unit) }), `e${key}`)
    }
    const q = quotaSum(s)
    if (q.target === null) {
      if (s.quotaBasis === 'marks')
        push('error', 'QUOTA_BASIS', 'kuota', fieldId(i, 'kuota'), problemMessage('QUOTA_BASIS', { label }))
    } else if (q.sum !== q.target) {
      push('error', 'QUOTA_SUM', 'kuota', fieldId(i, 'kuota'), problemMessage('QUOTA_SUM', { label, x: q.sum, y: q.target, unit: q.basis === 'questions' ? 'soalan' : 'markah' }))
    }
    const stated = s.levelShare
    if (stated.t4 !== null && stated.t5 !== null) {
      const d = derivedShare(s)
      if (!sameRatio(d, { t4: stated.t4, t5: stated.t5 }))
        push('error', 'LEVEL_SHARE', 'kuota', fieldId(i, 'nisbah'), problemMessage('LEVEL_SHARE', { label, a: d.t4, b: d.t5, c: stated.t4, d: stated.t5 }))
    }
  } else {
    push('incomplete', 'NO_QUOTA', 'kuota', fieldId(i, 'kuota'), incompleteMessage('NO_QUOTA', label))
  }

  // --- KBAT
  if (s.kbatMarks === null) {
    push('incomplete', 'NO_KBAT', 'kbat', fieldId(i, 'kbat'), incompleteMessage('NO_KBAT', label))
  } else {
    const offered = offeredMarks(s)
    if (offered !== null && s.kbatMarks > offered)
      push('error', 'KBAT_RANGE', 'kbat', fieldId(i, 'kbat'), problemMessage('KBAT_RANGE', { label, x: s.kbatMarks, y: offered }))
    if (s.kbatMarks > 0 && s.groups.length > 0 && s.groups.every((g) => g.tpMax <= 2)) {
      const lo = Math.min(...s.groups.map((g) => g.tpMin))
      const hi = Math.max(...s.groups.map((g) => g.tpMax))
      push('warning', 'KBAT_TP_BAND', 'kbat', fieldId(i, 'kbat'), problemMessage('KBAT_TP_BAND', { label, x: s.kbatMarks, a: lo, b: hi }))
    }
  }
  return out
}

/** Every problem of the form, paper level first. */
export function validateForm(f: ContractForm): Issue[] {
  const out: Issue[] = []
  if (!f.code.trim() || f.code.trim().length > CODE_MAX)
    out.push({ id: 'req-code', level: 'error', code: 'REQUIRED', section: null, part: 'umum', target: fieldId(null, 'code'), message: 'Kod kertas tidak sah. Contoh: 1449/1.' })
  if (f.durationMin === null || f.durationMin < 1 || f.durationMin > DURATION_MAX)
    out.push({ id: 'req-duration', level: 'error', code: 'REQUIRED', section: null, part: 'umum', target: fieldId(null, 'duration'), message: 'Tempoh mesti antara 1 dan 300 minit.' })
  if (f.questionCount !== null && (f.questionCount < 1 || f.questionCount > PAPER_QUESTIONS_MAX))
    out.push({ id: 'question-count', level: 'error', code: 'QUESTION_COUNT', section: null, part: 'umum', target: fieldId(null, 'question-count'), message: 'Bilangan soalan tidak sah.' })
  if (f.sections.length === 0)
    out.push({ id: 'req-sections', level: 'error', code: 'REQUIRED', section: null, part: 'umum', target: fieldId(null, 'bahagian'), message: 'Sekurang-kurangnya satu Bahagian diperlukan.' })

  const budgetSum = f.sections.reduce((n, s) => n + (s.markBudget ?? 0), 0)
  if (f.totalMarks === null || f.totalMarks < 1) {
    out.push({ id: 'req-total', level: 'error', code: 'REQUIRED', section: null, part: 'umum', target: fieldId(null, 'jumlah'), message: 'Jumlah markah diperlukan.' })
  } else if (f.sections.length > 0 && budgetSum !== f.totalMarks) {
    out.push({ id: 'total', level: 'error', code: 'TOTAL_MISMATCH', section: null, part: 'umum', target: fieldId(null, 'jumlah'), message: problemMessage('TOTAL_MISMATCH', { x: budgetSum, y: f.totalMarks }) })
  }

  f.sections.forEach((_, i) => out.push(...sectionIssues(f, i)))

  // Paper-level optional standards (design 4.2).
  if (f.kbatMarks !== null && f.sections.every((s) => s.kbatMarks !== null)) {
    const sum = f.sections.reduce((n, s) => n + (s.kbatMarks ?? 0), 0)
    if (sum !== f.kbatMarks)
      out.push({ id: 'kbat-total', level: 'error', code: 'KBAT_TOTAL', section: null, part: 'umum', target: fieldId(null, 'kbat'), message: problemMessage('KBAT_TOTAL', { x: f.kbatMarks, y: sum }) })
  }
  if (f.levelShare.t4 !== null && f.levelShare.t5 !== null) {
    const d = f.sections.reduce(
      (acc, s) => {
        const x = derivedShare(s)
        return { t4: acc.t4 + x.t4, t5: acc.t5 + x.t5 }
      },
      { t4: 0, t5: 0 },
    )
    if (!sameRatio(d, { t4: f.levelShare.t4, t5: f.levelShare.t5 }))
      out.push({ id: 'share-total', level: 'error', code: 'LEVEL_SHARE', section: null, part: 'umum', target: fieldId(null, 'nisbah'), message: problemMessage('LEVEL_SHARE', { label: 'Kertas', a: d.t4, b: d.t5, c: f.levelShare.t4, d: f.levelShare.t5 }) })
  }
  return out
}

export interface SectionStatus {
  struktur: 'ok' | 'error' | 'incomplete'
  profil: 'ok' | 'error' | 'incomplete'
  kuota: 'ok' | 'error' | 'incomplete'
  kbat: 'ok' | 'error' | 'incomplete'
}

/** The matrix of the Semakan panel: one row per Bahagian, four columns. */
export function sectionStatus(issues: readonly Issue[], i: number): SectionStatus {
  const cell = (part: SectionPart): 'ok' | 'error' | 'incomplete' => {
    const own = issues.filter((x) => x.section === i && x.part === part && x.level !== 'warning')
    if (own.some((x) => x.level === 'error')) return 'error'
    if (own.length) return 'incomplete'
    return 'ok'
  }
  return { struktur: cell('struktur'), profil: cell('profil'), kuota: cell('kuota'), kbat: cell('kbat') }
}

export const errorsOf = (issues: readonly Issue[]): Issue[] => issues.filter((x) => x.level === 'error')
export const incompleteOf = (issues: readonly Issue[]): Issue[] => issues.filter((x) => x.level === 'incomplete')

/** Problems of a stored view, as the server would check them (used by the mock verify). */
export function problemsOfForm(f: ContractForm): Issue[] {
  return validateForm(f)
}
