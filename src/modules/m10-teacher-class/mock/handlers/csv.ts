/**
 * The teacher CSV import of S21 (API-GUR-19, PRD-20 44-F3). The template and the row rules are the PRD's:
 *
 * - header `subjek,tingkatan,bab,sp,tp,aras,kesukaran,soalan,pilihan_a,pilihan_b,pilihan_c,pilihan_d,jawapan,penerangan`
 *   and one example row; the file is `templat-soalan.csv`;
 * - `.csv` only, at most 2 MB and 500 data rows (checked by the handler);
 * - a bad row is reported by its file line with the PRD reason and skipped; the other rows are imported;
 * - empty `bab`, `sp`, `tp`, `aras` are accepted (the admin completes them in review, D112).
 *
 * The records are M04's public `parseCsv` (one parser, D12); the rows become M04 `QuestionInput`s.
 */

import { curriculum } from '@/modules/m03-curriculum/mock'
import { parseCsv } from '@/modules/m04-question-bank/mock'
import type { QuestionInput } from '@/modules/m04-question-bank/mock'

import { dskpRepo } from '../repository/dskp'

export const TEMPLATE_NAME = 'templat-soalan.csv'

export const TEMPLATE_HEADER = [
  'subjek',
  'tingkatan',
  'bab',
  'sp',
  'tp',
  'aras',
  'kesukaran',
  'soalan',
  'pilihan_a',
  'pilihan_b',
  'pilihan_c',
  'pilihan_d',
  'jawapan',
  'penerangan',
] as const

/** The template file text: the header and the PRD example row. */
export const TEMPLATE_CSV = `${TEMPLATE_HEADER.join(',')}\nMatematik,4,Bab 1,1.1.1,3,mengaplikasi,3,Contoh soalan?,A,B,C,D,A,Contoh penerangan\n`

const REQUIRED = [
  'subjek',
  'tingkatan',
  'soalan',
  'pilihan_a',
  'pilihan_b',
  'pilihan_c',
  'pilihan_d',
  'jawapan',
] as const

export const TEXT_MAX = 2000
export const OPTION_MAX = 500
export const MAX_ROWS = 500
export const MSG_TOO_MANY = 'Fail melebihi 500 baris.'
export const MSG_TEXT_LONG = 'Soalan tidak boleh melebihi 2000 aksara.'
export const MSG_OPTION_LONG = 'Pilihan tidak boleh melebihi 500 aksara.'
const ARAS = ['mengingat', 'memahami', 'mengaplikasi', 'menganalisis', 'menilai', 'mencipta']

export interface ImportPlan {
  /** Required header columns the file lacks (a non-empty list refuses the file). */
  missingColumns: string[]
  rows: QuestionInput[]
  failures: { row: number; message: string }[]
  /** Data records seen (planned + failed). */
  dataRows: number
}

const norm = (v: string): string => v.trim().toLowerCase()

/** Reads the whole file and plans the valid rows; failures are ordered by line. */
export function planImport(text: string): ImportPlan {
  const records = parseCsv(text)
  const header = (records[0]?.cells ?? []).map(norm)
  const missingColumns = REQUIRED.filter((c) => !header.includes(c))
  const plan: ImportPlan = { missingColumns, rows: [], failures: [], dataRows: 0 }
  if (missingColumns.length > 0) return plan
  const col = (cells: string[], name: string): string => (cells[header.indexOf(name)] ?? '').trim()

  for (const rec of records.slice(1)) {
    plan.dataRows++
    const c = rec.cells
    const fail = (message: string): void => {
      plan.failures.push({ row: rec.line, message })
    }

    const subject = curriculum.subjects().find((s) => norm(s.name) === norm(col(c, 'subjek')))
    if (!subject) {
      fail('Subjek tidak dikenali.')
      continue
    }
    const levelNo = Number(col(c, 'tingkatan'))
    const level =
      Number.isInteger(levelNo) && levelNo >= 1 && levelNo <= 5
        ? curriculum.levels().find((l) => l.name === `Tingkatan ${String(levelNo)}`)
        : undefined
    if (!level) {
      fail('Tingkatan mesti antara 1 dan 5.')
      continue
    }
    const tpText = col(c, 'tp')
    const tp = Number(tpText)
    if (tpText !== '' && !(Number.isInteger(tp) && tp >= 1 && tp <= 6)) {
      fail('Tahap Penguasaan (TP) mesti antara 1 dan 6.')
      continue
    }
    const aras = norm(col(c, 'aras'))
    if (aras !== '' && !ARAS.includes(aras)) {
      fail('Aras pemikiran tidak sah.')
      continue
    }
    const hardText = col(c, 'kesukaran')
    let difficulty = tpText !== '' ? Math.min(5, tp) : 3
    if (hardText !== '') {
      const d = Number(hardText)
      if (!(Number.isInteger(d) && d >= 1 && d <= 5)) {
        fail('Kesukaran mesti antara 1 dan 5.')
        continue
      }
      difficulty = d
    }
    const letter = col(c, 'jawapan').toUpperCase()
    if (!/^[A-D]$/.test(letter)) {
      fail('Jawapan mesti A, B, C atau D.')
      continue
    }

    let chapterId: number | null = null
    const bab = col(c, 'bab')
    if (bab !== '') {
      const chapters = curriculum.chapters(subject.id, level.id)
      const number = /^(?:bab\s*)?(\d+)$/i.exec(bab)?.[1]
      const found =
        chapters.find((ch) => number !== undefined && ch.chapterNumber === Number(number)) ??
        chapters.find((ch) => norm(ch.name ?? '') === norm(bab))
      if (!found) {
        fail(`Bab tidak dijumpai: ${bab}`)
        continue
      }
      chapterId = found.id
    }
    let spId: number | null = null
    const sp = col(c, 'sp')
    if (sp !== '') {
      const found = dskpRepo
        .bidang({ subjectId: subject.id, educationLevelId: level.id })
        .flatMap((b) => dskpRepo.sk(b.id))
        .flatMap((k) => dskpRepo.sp(k.id))
        .find((s) => norm(s.code ?? '') === norm(sp))
      if (!found) {
        fail(`SP tidak dijumpai: ${sp}`)
        continue
      }
      spId = found.id
    }

    const question = col(c, 'soalan')
    if (question === '') {
      fail('Soalan diperlukan.')
      continue
    }
    const options = ['a', 'b', 'c', 'd'].map((l) => col(c, `pilihan_${l}`))
    const emptyAt = options.findIndex((o) => o === '')
    if (emptyAt >= 0) {
      fail(`Pilihan ${'ABCD'[emptyAt] as string} diperlukan.`)
      continue
    }
    if ([...question].length > TEXT_MAX) {
      fail(MSG_TEXT_LONG)
      continue
    }
    if (options.some((o) => [...o].length > OPTION_MAX)) {
      fail(MSG_OPTION_LONG)
      continue
    }
    const explanation = col(c, 'penerangan')
    plan.rows.push({
      subjectId: subject.id,
      educationLevelId: level.id,
      difficultyLevel: difficulty,
      questionType: 'mcq',
      questionText: question,
      options,
      correctAnswer: letter.charCodeAt(0) - 65,
      ...(explanation !== '' ? { explanation } : {}),
      curriculumChapterId: chapterId,
      dskpSpId: spId,
    })
  }
  return plan
}
