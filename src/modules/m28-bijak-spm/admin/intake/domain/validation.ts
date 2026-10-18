/**
 * Quality gate "Hantar untuk semakan" (v2-question-bank 4.8): the same function runs in the review
 * screen (live list of what is missing) and in the server (no bypass, E9).
 */
import type { IntakeBatch, IntakeIssue, IntakeQuestion } from '../types'
import { groupsOf } from './grouping'
import { questionMarks, schemeTotal } from './marks'

export function fieldName(f: string): string {
  switch (f) {
    case 'tag.unit':
      return 'unit DSKP'
    case 'tag.sp':
      return 'SP'
    case 'marks':
      return 'markah'
    case 'stem':
      return 'teks soalan'
    case 'scheme':
      return 'skema'
    default:
      return f
  }
}

export function validateBatch(
  batch: Pick<IntakeBatch, 'questions' | 'stimuli' | 'source' | 'copyright'>,
): IntakeIssue[] {
  const issues: IntakeIssue[] = []
  const add = (q: IntakeQuestion | undefined, where: string, message: string): void => {
    issues.push({ questionId: q?.id, where, message })
  }
  const label = (q: IntakeQuestion, part = ''): string => `Soalan ${q.label}${part}`

  if (batch.questions.length === 0)
    add(undefined, 'Kertas', 'Tiada soalan. Tambah sekurang-kurangnya satu soalan.')
  if (!batch.source.trim()) add(undefined, 'Kertas', 'Pengisytiharan sumber diperlukan.')
  if (!batch.copyright) add(undefined, 'Kertas', 'Status hak cipta diperlukan.')

  for (const q of batch.questions) {
    const w = label(q)
    if (!q.stem.trim() && q.parts.length === 0) add(q, w, 'Teks soalan kosong.')
    if (q.needsManual) add(q, w, 'Soalan ini perlu disemak manual. Tandakan selesai disemak.')

    if (q.type === 'mcq') {
      if (q.options.length < 2) add(q, w, 'Soalan objektif perlu sekurang-kurangnya 2 pilihan.')
      if (q.options.some((o) => !o.text.trim())) add(q, w, 'Ada pilihan jawapan yang kosong.')
      const key = q.scheme?.kind === 'option' ? q.scheme.correct : ''
      if (!q.options.some((o) => o.id === key)) add(q, w, 'Kunci jawapan belum dipilih.')
      if (q.marks <= 0) add(q, w, 'Markah mesti lebih daripada 0.')
    } else if (q.parts.length > 0) {
      for (const p of q.parts) {
        const pw = label(q, p.label)
        if (!p.prompt.trim()) add(q, pw, 'Teks bahagian kosong.')
        if (p.marks <= 0) add(q, pw, 'Markah mesti lebih daripada 0.')
        if (!p.scheme) add(q, pw, 'Skema pemarkahan tiada.')
        else if (schemeTotal(p.scheme) !== p.marks)
          add(
            q,
            pw,
            `Jumlah markah skema (${schemeTotal(p.scheme)}) tidak sama dengan markah bahagian (${p.marks}).`,
          )
        if (p.scheme?.kind === 'points' && p.scheme.points.some((pt) => !pt.label.trim()))
          add(q, pw, 'Ada mata skema tanpa penerangan.')
      }
    } else {
      if (q.marks <= 0) add(q, w, 'Markah mesti lebih daripada 0.')
      if (!q.scheme) add(q, w, 'Skema pemarkahan tiada.')
      else if (schemeTotal(q.scheme) !== q.marks)
        add(
          q,
          w,
          `Jumlah markah skema (${schemeTotal(q.scheme)}) tidak sama dengan markah soalan (${q.marks}).`,
        )
    }
    if (questionMarks(q) <= 0 && q.type !== 'mcq' && q.parts.length > 0)
      add(q, w, 'Jumlah markah soalan ialah 0.')

    const t = q.tag
    if (!t.subject || !t.level) add(q, w, 'Subjek dan tingkatan perlu ditetapkan.')
    if (t.unit === null && t.formOrigin !== 'T1-T3') add(q, w, 'Unit DSKP belum dipilih.')
    if (t.sp.length === 0) add(q, w, 'Standard Pembelajaran (SP) belum dipilih.')
    if (!(t.tp >= 1 && t.tp <= 6)) add(q, w, 'Tahap Penguasaan (TP) mesti antara 1 dan 6.')
    for (const f of q.lowFields)
      if (!q.confirmed.includes(f))
        add(q, w, `Medan keyakinan rendah belum disahkan: ${fieldName(f)}.`)

    if (q.stimulusId && !batch.stimuli.some((s) => s.id === q.stimulusId))
      add(q, w, 'Rajah / petikan yang dirujuk tidak wujud.')
  }

  for (const g of groupsOf(batch.questions)) {
    if (!g.contiguous) {
      const s = batch.stimuli.find((x) => x.id === g.stimulusId)
      add(undefined, s?.label ?? 'Kumpulan', 'Soalan dalam satu kumpulan mesti berturutan.')
    }
  }
  for (const s of batch.stimuli) {
    if (!s.alt.trim()) add(undefined, s.label, 'Teks alternatif (alt) bagi rajah diperlukan.')
  }
  return issues
}
