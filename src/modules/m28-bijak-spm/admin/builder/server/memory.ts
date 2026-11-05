/**
 * In-browser mock of `BuilderApi` for `VITE_API_MODE != http`. It sits on the existing admin mock
 * (`bijakAdminServer()`: papers, blueprints and bank) and adds the builder behaviour on top: whole
 * stimulus groups on add/remove (D90), the review (blockers) and the student view. Nothing here
 * ships in the http build (see `./client`).
 */
import { BIJAK_BUILDER_MESSAGES, bijakNegeriSlug } from '@pp/contract'
import type {
  BijakBuilderPoolUnit,
  BijakBuilderStudentView,
  BijakDskpUnit,
  BijakPoolPreview,
} from '@pp/contract'

import type { AdminPaperSummary, BuilderQuestion, PaperEditorData } from '../../../domain/admin-types'
import { addUnit, checkPaper, removeUnit, unitsOf } from '../../../domain/paper-builder'
import { kontrakServer } from '../../kontrak/server/client'
import {
  BuilderError,
  type BuilderApi,
  type BuilderSubject,
  type HeaderPatch,
  type PlacementResult,
  type RawReview,
  type PublishOptions,
  type PublishResult,
  type ReferencePanel,
  type SectionPatch,
  type SectionPool,
  type SectionPoolQuery,
  type SubjektifCreate,
  type SubjektifPage,
  type SubjektifQuery,
} from './api'

const ALREADY = (id: string): string => `Soalan ${id} sudah ada dalam kertas ini`
const NOT_PLACED = (id: string): string => `Soalan ${id} tiada dalam kertas ini`
const LOCKED = 'Kertas Terbit tidak boleh disunting. Tarik balik dahulu.'
const ORDER = 'Susunan mesti menyenaraikan setiap soalan atau kumpulan dalam bahagian tepat sekali'

type AdminMock = Awaited<ReturnType<typeof loadAdmin>>
async function loadAdmin() {
  const { bijakAdminServer } = await import('../../../server/client')
  return bijakAdminServer()
}

/**
 * Test / demo hook: blueprint-conformance lines (the kind T34 lets an admin override, for example
 * "Kontrak Simulasi ... belum Disahkan") for a paper. The default derives it from the Kontrak source; tests inject their own.
 */
export type OverridableLines = (editor: PaperEditorData) => string[] | Promise<string[]>

/**
 * The mock's default for the T34 rule: Terbit needs the paper's Kontrak to be Disahkan; a Draf or Spec
 * one is the overridable BLUEPRINT_NOT_VERIFIED blocker (same line as `builder.constants.ts`).
 */
const blueprintLines: OverridableLines = async (editor) => {
  const { subject, kertas } = editor.paper
  const bp = await kontrakServer().get(subject, kertas).catch(() => null)
  if (!bp || bp.source === 'Disahkan') return []
  return [`Kontrak Simulasi ${bp.code} (versi ${bp.version}) belum Disahkan (status: ${bp.source}); Terbit memerlukan kontrak Disahkan.`]
}

/** Contract code of a hard blocker line (BM text of `checkPaper`); the mock only needs a stable code. */
function hardCode(message: string): 'COUNT_TOO_FEW' | 'COUNT_TOO_MANY' | 'MARKS_MISMATCH' | 'NOT_PUBLISHED' | 'DUPLICATE_QUESTION' | 'GROUP_INCOMPLETE' {
  if (/Lebih \d+ soalan/.test(message)) return 'COUNT_TOO_MANY'
  if (/^.*Markah /.test(message)) return 'MARKS_MISMATCH'
  if (/belum Terbit/.test(message)) return 'NOT_PUBLISHED'
  if (/berulang/.test(message)) return 'DUPLICATE_QUESTION'
  if (/tidak lengkap/.test(message)) return 'GROUP_INCOMPLETE'
  return 'COUNT_TOO_FEW'
}

/* ------------------------------------------------------------------- S3-T06 Kertas Subjektif */

interface SjQuestion {
  id: string
  preview: string
  marks: number
  hasScheme: boolean
}
interface SjPaper {
  id: string
  title: string
  subject: string
  subjectName: string
  kertas: number
  examBoard: string
  year: number
  durationMinutes: number | null
  totalMarks: number
  status: 'draf' | 'terbit'
  questions: SjQuestion[]
  updatedAt: number
}

const SJ_SUBJECTS: Record<string, string> = { BM: 'Bahasa Melayu', MAT: 'Matematik', SN: 'Sains' }
const SJ_AT = 1_800_000_000_000
const fill = (text: string, vars: Record<string, string | number>): string =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))

/** Seed: two published papers (one with a question that has no scheme) and one empty draft; fictional titles. */
function sjSeed(): SjPaper[] {
  const q = (n: number, marks: number, hasScheme = true): SjQuestion => ({ id: String(9000 + n), preview: `Soalan contoh ${n}`, marks, hasScheme })
  return [
    { id: 'sj-1', title: 'Bahasa Melayu Kertas 2 - Percubaan Contoh', subject: 'BM', subjectName: 'Bahasa Melayu', kertas: 2, examBoard: 'Selangor', year: 2025, durationMinutes: 150, totalMarks: 40, status: 'terbit', questions: [q(1, 20), q(2, 20)], updatedAt: SJ_AT },
    { id: 'sj-2', title: 'Matematik Kertas 2 - Percubaan Contoh', subject: 'MAT', subjectName: 'Matematik', kertas: 2, examBoard: 'MRSM', year: 2024, durationMinutes: null, totalMarks: 30, status: 'terbit', questions: [q(3, 10), q(4, 20, false)], updatedAt: SJ_AT - 86_400_000 },
    { id: 'sj-3', title: 'Sains Kertas 3 - Percubaan Contoh', subject: 'SN', subjectName: 'Sains', kertas: 3, examBoard: 'Johor', year: 2025, durationMinutes: 0, totalMarks: 50, status: 'draf', questions: [], updatedAt: SJ_AT - 172_800_000 },
  ]
}

const sjRow = (p: SjPaper): AdminPaperSummary => ({
  id: p.id,
  title: p.title,
  subject: p.subject,
  subjectName: p.subjectName,
  kertas: p.kertas,
  code: `K${p.kertas}`,
  status: p.status,
  questionCount: p.questions.length,
  marks: p.questions.reduce((n, x) => n + x.marks, 0),
  budget: p.totalMarks,
  ok: true,
  updatedAt: p.updatedAt,
  surface: 'subjektif',
  examBoard: p.examBoard,
  year: p.year,
  schemeCount: p.questions.filter((x) => x.hasScheme).length,
  totalMarks: p.totalMarks,
  durationMinutes: p.durationMinutes,
})

function sjEditor(p: SjPaper): PaperEditorData {
  const section = {
    id: `${p.id}-s1`,
    label: 'Bahagian A',
    markBudget: p.totalMarks,
    questionCount: p.questions.length,
    rule: { type: 'all' as const },
    questionIds: p.questions.map((x) => x.id),
  }
  return {
    paper: {
      id: p.id,
      title: p.title,
      subject: p.subject,
      kertas: p.kertas as 1 | 2,
      year: p.year,
      code: `K${p.kertas}`,
      durationMin: p.durationMinutes ?? 0,
      instructions: [],
      sections: [section],
      status: p.status,
      createdAt: p.updatedAt,
      updatedAt: p.updatedAt,
      surface: 'subjektif',
      examBoard: p.examBoard,
      durationMinutes: p.durationMinutes,
      totalMarks: p.totalMarks,
    },
    blueprint: null,
    questions: p.questions.map((x) => ({
      id: x.id,
      preview: x.preview,
      marks: x.marks,
      kind: 'berstruktur' as const,
      topic: 'Contoh',
      status: 'terbit' as const,
      kertas: p.kertas,
      subject: p.subject,
      // `servable` is deliberately not the scheme flag (a Terbit paper reads servable for every pinned question).
      servable: true,
      hasScheme: x.hasScheme,
    })),
    groups: [],
  }
}

/** Field checks of 18-02..18-08 (the 422 `fields` of the server). */
function sjValidate(v: { title?: string; examBoard?: string; year?: number; durationMinutes?: number | null; totalMarks?: number }): Record<string, string> {
  const f: Record<string, string> = {}
  const m = BIJAK_BUILDER_MESSAGES
  if (!v.title?.trim()) f.title = m.subjektifTitleRequired
  else if (v.title.trim().length > 150) f.title = m.subjektifTitleTooLong
  if (!v.examBoard?.trim()) f.examBoard = m.examBoardRequired
  if (!v.year) f.year = m.yearRequired
  if (v.durationMinutes != null && (!Number.isInteger(v.durationMinutes) || v.durationMinutes < 0 || v.durationMinutes > 300)) f.durationMinutes = m.durationRange
  if (!v.totalMarks || !Number.isInteger(v.totalMarks) || v.totalMarks < 1 || v.totalMarks > 200) f.totalMarks = m.totalMarksRange
  return f
}

export class MockBuilderServer implements BuilderApi {
  constructor(private readonly overridable: OverridableLines = blueprintLines) {}
  private admin: Promise<AdminMock> | null = null
  private a(): Promise<AdminMock> {
    this.admin ??= loadAdmin()
    return this.admin
  }

  async listSets(): Promise<AdminPaperSummary[]> {
    return (await this.a()).listAdminPapers()
  }

  async builderSubjects(): Promise<BuilderSubject[]> {
    const rows = await (await this.a()).listBlueprints()
    const out = new Map<string, BuilderSubject>()
    for (const b of rows) {
      const s = out.get(b.subject) ?? { code: b.subject, name: b.subjectName, kertas: [] }
      if (!s.kertas.includes(b.kertas)) s.kertas.push(b.kertas)
      out.set(b.subject, s)
    }
    return [...out.values()]
  }

  async create(input: { subject: string; kertas: number; title?: string }): Promise<string> {
    const a = await this.a()
    return a.createPaper({
      subject: input.subject,
      kertas: input.kertas as 1 | 2,
      ...(input.title ? { title: input.title } : {}),
    })
  }

  async generate(subject: string, kertas: number): Promise<string> {
    const { paperId } = await kontrakServer().generateDraft(subject, kertas)
    return paperId
  }

  poolPreview(subject: string, kertas: number): Promise<BijakPoolPreview> {
    return kontrakServer().pool(subject, kertas)
  }

  private sj: SjPaper[] = sjSeed()
  private sjSeq = 3
  private sjFind(id: string): SjPaper | undefined {
    return this.sj.find((p) => p.id === id)
  }

  async getEditor(id: string): Promise<PaperEditorData> {
    const sj = this.sjFind(id)
    if (sj) return sjEditor(sj)
    return (await this.a()).getPaperEditor(id)
  }

  async updateHeader(id: string, patch: HeaderPatch): Promise<PaperEditorData> {
    const sj = this.sjFind(id)
    if (sj) {
      if (sj.status === 'terbit') throw new BuilderError('invalid', LOCKED)
      const fields = sjValidate({
        title: patch.title ?? sj.title,
        examBoard: patch.examBoard ?? sj.examBoard,
        year: patch.year ?? sj.year,
        durationMinutes: patch.durationMinutes === undefined ? sj.durationMinutes : patch.durationMinutes,
        totalMarks: patch.totalMarks ?? sj.totalMarks,
      })
      if (Object.keys(fields).length) throw new BuilderError('invalid', Object.values(fields)[0]!, { fields })
      if (patch.title !== undefined) sj.title = patch.title.trim()
      if (patch.examBoard !== undefined) sj.examBoard = patch.examBoard
      if (patch.year !== undefined) sj.year = patch.year
      if (patch.durationMinutes !== undefined) sj.durationMinutes = patch.durationMinutes
      if (patch.totalMarks !== undefined) sj.totalMarks = patch.totalMarks
      return sjEditor(sj)
    }
    const a = await this.a()
    const { instructions, ...rest } = patch
    const ed = await a.getPaperEditor(id)
    // The mock hands out its live paper object: instructions are set on it, then saved to persist.
    if (instructions && ed.paper.status !== 'terbit') ed.paper.instructions = [...instructions]
    return a.savePaper(id, rest)
  }

  private async mutate(id: string, sectionId: string, fn: (ids: string[], ed: PaperEditorData) => string[]): Promise<PaperEditorData> {
    const a = await this.a()
    const ed = await a.getPaperEditor(id)
    if (ed.paper.status === 'terbit') throw new BuilderError('invalid', LOCKED)
    const sec = ed.paper.sections.find((s) => s.id === sectionId)
    if (!sec) throw new BuilderError('invalid', 'Bahagian tidak sah')
    return a.savePaper(id, { sections: [{ id: sectionId, questionIds: fn([...sec.questionIds], ed) }] })
  }

  private helpers(ed: PaperEditorData) {
    const q = new Map(ed.questions.map((x) => [x.id, x]))
    const g = new Map(ed.groups.map((x) => [x.id, x]))
    return {
      q,
      g,
      groupOf: (id: string) => q.get(id)?.groupId,
      membersOf: (gid: string) => g.get(gid)?.questionIds ?? [],
    }
  }

  async addPlacement(id: string, sectionId: string, questionId: string): Promise<PlacementResult> {
    const before = await this.getEditor(id)
    const h = this.helpers(before)
    const members = h.groupOf(questionId) ? h.membersOf(h.groupOf(questionId)!) : [questionId]
    const onPaper = new Set(before.paper.sections.flatMap((s) => s.questionIds))
    for (const m of members) if (onPaper.has(m)) throw new BuilderError('invalid', ALREADY(m))
    const editor = await this.mutate(id, sectionId, (ids) => addUnit(ids, questionId, h.groupOf, h.membersOf))
    return { editor, changed: members }
  }

  async removePlacement(id: string, questionId: string): Promise<PlacementResult> {
    const before = await this.getEditor(id)
    const sec = before.paper.sections.find((s) => s.questionIds.includes(questionId))
    if (!sec) throw new BuilderError('invalid', NOT_PLACED(questionId))
    const h = this.helpers(before)
    const members = h.groupOf(questionId) ? h.membersOf(h.groupOf(questionId)!) : [questionId]
    const editor = await this.mutate(id, sec.id, (ids) => removeUnit(ids, questionId, h.groupOf))
    return { editor, changed: members }
  }

  async reorder(id: string, sectionId: string, order: string[]): Promise<PaperEditorData> {
    const before = await this.getEditor(id)
    const h = this.helpers(before)
    return this.mutate(id, sectionId, (ids) => {
      const units = unitsOf(ids, h.groupOf)
      const byRep = new Map<string, string[]>()
      for (const u of units) for (const m of u.ids) byRep.set(m, u.ids)
      const seen = new Set<string[]>()
      const next: string[] = []
      for (const rep of order) {
        const u = byRep.get(rep)
        if (!u || seen.has(u)) throw new BuilderError('invalid', ORDER)
        seen.add(u)
        next.push(...u)
      }
      if (seen.size !== units.length) throw new BuilderError('invalid', ORDER)
      return next
    })
  }

  async pool(id: string, sectionId: string, query: SectionPoolQuery = {}): Promise<SectionPool> {
    const ed = await this.getEditor(id)
    if (!ed.paper.sections.some((s) => s.id === sectionId)) throw new BuilderError('invalid', 'Bahagian tidak sah')
    const placed = new Set(ed.paper.sections.flatMap((s) => s.questionIds))
    const term = (query.q ?? '').trim().toLowerCase()
    const h = this.helpers(ed)
    const done = new Set<string>()
    const units: BijakBuilderPoolUnit[] = []
    for (const q of ed.questions) {
      if (q.status !== 'terbit' || done.has(q.id)) continue
      const ids = q.groupId ? h.membersOf(q.groupId) : [q.id]
      ids.forEach((x) => done.add(x))
      const qs = ids.map((x) => h.q.get(x)).filter((x): x is BuilderQuestion => !!x)
      if (term && !qs.some((x) => `${x.preview} ${x.topic} ${x.id}`.toLowerCase().includes(term))) continue
      const stimulus = q.groupId ? h.g.get(q.groupId)?.stimulus : undefined
      units.push({
        ...(q.groupId ? { groupId: q.groupId } : {}),
        ...(stimulus ? { stimulus: stimulus } : {}),
        questionIds: ids,
        questions: qs as unknown as BijakBuilderPoolUnit['questions'],
        marks: qs.reduce((n, x) => n + x.marks, 0),
        eligible: true,
        reasons: [],
        placed: ids.some((x) => placed.has(x)),
      })
    }
    const pageSize = query.pageSize ?? 20
    const page = query.page ?? 1
    return {
      units: units.slice((page - 1) * pageSize, page * pageSize),
      total: units.length,
      totalPages: Math.max(1, Math.ceil(units.length / pageSize)),
    }
  }

  async review(id: string): Promise<RawReview> {
    const ed = await this.getEditor(id)
    const h = this.helpers(ed)
    const check = checkPaper({
      specs: ed.paper.sections.map((s) => ({ label: s.label, markBudget: s.markBudget, questionCount: s.questionCount, rule: s.rule })),
      sections: ed.paper.sections.map((s) => ({ questionIds: s.questionIds })),
      marksOf: (qid) => h.q.get(qid)?.marks ?? 0,
      groupOf: h.groupOf,
      membersOf: h.membersOf,
      isLive: (qid) => h.q.get(qid)?.status === 'terbit',
    })
    const overridableLines = await this.overridable(ed)
    const blockers = [...check.errors, ...check.sections.flatMap((s) => s.errors.map((e) => `${s.label}: ${e}`))]
    const notes = check.sections.flatMap((s) => s.notes.map((n) => `${s.label}: ${n}`))
    return {
      paperId: id,
      status: ed.paper.status,
      ok: blockers.length === 0 && overridableLines.length === 0,
      blockers: [...blockers, ...overridableLines],
      blockerDetails: [
        ...blockers.map((message) => ({ code: hardCode(message), message, overridable: false })),
        ...overridableLines.map((message) => ({ code: 'BLUEPRINT_NOT_VERIFIED' as const, message, overridable: true })),
      ],
      canOverride: blockers.length === 0 && overridableLines.length > 0,
      notes,
      blueprintNeedsReview: notes.length > 0,
      visibleToStudents: ed.paper.status === 'terbit',
      totalMarks: check.totalMarks,
      totalBudget: check.totalBudget,
      rows: ed.paper.sections.flatMap((s) =>
        s.questionIds.map((questionId) => {
          const q = h.q.get(questionId)
          const ok = q?.status === 'terbit'
          return {
            questionId,
            ...(q?.groupId ? { groupId: q.groupId } : {}),
            section: s.label,
            ok,
            ...(ok ? {} : { reason: 'masih draf' }),
          }
        }),
      ),
    }
  }

  async studentView(id: string): Promise<BijakBuilderStudentView> {
    const ed = await this.getEditor(id)
    const h = this.helpers(ed)
    const rv = await this.review(id)
    let n = 1
    return {
      title: ed.paper.title,
      subject: ed.paper.subject,
      subjectName: ed.blueprint?.subjectName ?? ed.paper.subject,
      kertas: ed.paper.kertas,
      year: ed.paper.year,
      code: ed.paper.code,
      durationMin: ed.paper.durationMin,
      instructions: ed.paper.instructions,
      reference: [],
      questionCount: ed.paper.sections.reduce((c, s) => c + s.questionIds.length, 0),
      marks: rv.totalMarks,
      sections: ed.paper.sections.map((s) => ({
        label: s.label,
        instruction:
          s.instruction ?? (s.rule.type === 'all' ? 'Jawab semua soalan.' : `Jawab ${s.rule.n} soalan sahaja.`),
        compulsory: !!s.compulsory,
        marks: 0,
        units: unitsOf(s.questionIds, h.groupOf).map((u) => ({
          ...(u.groupId ? { groupId: u.groupId } : {}),
          ...(u.groupId && h.g.get(u.groupId)
            ? { stimulus: h.g.get(u.groupId)!.stimulus }
            : {}),
          questions: u.ids.map((qid) => ({
            id: qid,
            number: n++,
            preview: h.q.get(qid)?.preview ?? qid,
            marks: h.q.get(qid)?.marks ?? 0,
          })),
        })),
      })),
    }
  }

  async publish(id: string, options: PublishOptions = {}): Promise<PublishResult> {
    const sj = this.sjFind(id)
    if (sj) {
      const errors: string[] = []
      if (sj.questions.length === 0) errors.push(fill(BIJAK_BUILDER_MESSAGES.subjektifNoContent, { title: sj.title }))
      for (const x of sj.questions) if (!x.hasScheme) errors.push(`${x.preview}: ${BIJAK_BUILDER_MESSAGES.subjektifNoScheme}`)
      const sum = sj.questions.reduce((n, x) => n + x.marks, 0)
      if (sj.questions.length && sum !== sj.totalMarks)
        errors.push(fill(BIJAK_BUILDER_MESSAGES.totalMarksMismatch, { a: sj.totalMarks, b: sum }))
      if (errors.length) return { ok: false, errors, blockerDetails: [], canOverride: false }
      sj.status = 'terbit'
      return { ok: true, errors: [] }
    }
    if (options.override && (options.reason ?? '').trim().length < 5)
      throw new BuilderError('invalid', 'Sebab diperlukan untuk menerbitkan walaupun tidak memenuhi kontrak blueprint')
    const a = await this.a()
    const lines = await this.overridable(await a.getPaperEditor(id))
    if (lines.length && !options.override) {
      const rv = await this.review(id)
      return { ok: false, errors: rv.blockers, blockerDetails: rv.blockerDetails, canOverride: rv.canOverride }
    }
    const r = await a.publishPaper(id)
    if (!r.ok) {
      const rv = await this.review(id)
      return { ok: false, errors: r.errors, blockerDetails: rv.blockerDetails, canOverride: rv.canOverride }
    }
    return { ok: true, errors: [], ...(lines.length ? { overridden: lines } : {}) }
  }

  async updateSection(id: string, sectionId: string, patch: SectionPatch): Promise<PaperEditorData> {
    const a = await this.a()
    const ed = await a.getPaperEditor(id)
    if (ed.paper.status === 'terbit') throw new BuilderError('invalid', LOCKED)
    const sec = ed.paper.sections.find((s) => s.id === sectionId)
    if (!sec) throw new BuilderError('invalid', 'Bahagian tidak sah')
    if (patch.label !== undefined) {
      if (!patch.label.trim()) throw new BuilderError('invalid', 'Nama bahagian diperlukan')
      sec.label = patch.label.trim()
    }
    if (patch.instruction !== undefined) {
      const v = (patch.instruction ?? '').trim()
      if (v) sec.instruction = v
      else delete sec.instruction
    }
    if (patch.compulsory !== undefined) sec.compulsory = patch.compulsory
    // The mock hands out its live paper: saving persists it.
    return a.savePaper(id, {})
  }

  async updateReference(id: string, panels: ReferencePanel[]): Promise<PaperEditorData> {
    const a = await this.a()
    const ed = await a.getPaperEditor(id)
    if (ed.paper.status === 'terbit') throw new BuilderError('invalid', LOCKED)
    if (panels.some((p) => !p.title.trim())) throw new BuilderError('invalid', 'Tajuk panel diperlukan')
    ;(ed.paper as unknown as { reference: ReferencePanel[] }).reference = panels.map((p) => ({ ...p, items: [...p.items] }))
    return a.savePaper(id, {})
  }

  async updateGroupLabel(id: string, groupId: string, label: string): Promise<PaperEditorData> {
    const a = await this.a()
    const ed = await a.getPaperEditor(id)
    if (ed.paper.status === 'terbit') throw new BuilderError('invalid', LOCKED)
    const g = ed.groups.find((x) => x.id === groupId)
    if (!g || !ed.paper.sections.some((s) => s.questionIds.some((q) => g.questionIds.includes(q))))
      throw new BuilderError('invalid', 'Kumpulan rangsangan ini tiada dalam kertas ini')
    if (!label.trim()) throw new BuilderError('invalid', 'Tajuk petikan diperlukan')
    // A group with `stimuli: []` has nothing to title (REQ-A-008): refuse instead of crashing.
    if (!g.stimulus) throw new BuilderError('invalid', 'Kumpulan rangsangan ini tiada rangsangan untuk dinamakan')
    g.stimulus.label = label.trim()
    return a.savePaper(id, {})
  }

  async withdraw(id: string): Promise<void> {
    const sj = this.sjFind(id)
    if (sj) {
      sj.status = 'draf'
      return
    }
    await (await this.a()).unpublishPaper(id)
  }

  async copy(id: string): Promise<string> {
    const a = await this.a()
    const ed = await a.getPaperEditor(id)
    const newId = await a.createPaper({ subject: ed.paper.subject, kertas: ed.paper.kertas, title: `${ed.paper.title} (Salinan)` })
    await a.savePaper(newId, {
      year: ed.paper.year,
      durationMin: ed.paper.durationMin,
      sections: ed.paper.sections.map((s) => ({ id: s.id, questionIds: [...s.questionIds] })),
    })
    return newId
  }

  async units(subject: string): Promise<BijakDskpUnit[]> {
    return kontrakServer().listUnits(subject)
  }

  async listSubjektif(query: SubjektifQuery = {}): Promise<SubjektifPage> {
    await Promise.resolve()
    const all = this.sj
    const hit = all.filter(
      (p) =>
        (!query.subject || p.subject === query.subject) &&
        (!query.kertas || p.kertas === query.kertas) &&
        (!query.status || p.status === query.status) &&
        (!query.year || p.year === query.year) &&
        (!query.negeri || bijakNegeriSlug(p.examBoard) === bijakNegeriSlug(query.negeri)),
    )
    const size = query.pageSize ?? 25
    const page = query.page ?? 1
    const full = (p: SjPaper): boolean => p.questions.length > 0 && p.questions.every((x) => x.hasScheme)
    return {
      rows: hit.slice((page - 1) * size, page * size).map(sjRow),
      total: hit.length,
      counts: { total: all.length, published: all.filter((p) => p.status === 'terbit').length, withScheme: all.filter(full).length },
    }
  }

  async createSubjektif(input: SubjektifCreate): Promise<{ id: string }> {
    await Promise.resolve()
    const fields = sjValidate(input)
    if (!input.subject) fields.subject = BIJAK_BUILDER_MESSAGES.subjectRequired
    if (![2, 3, 4].includes(input.kertas)) fields.kertas = BIJAK_BUILDER_MESSAGES.kertasInvalid
    if (Object.keys(fields).length) throw new BuilderError('invalid', Object.values(fields)[0]!, { fields })
    this.sjSeq += 1
    const id = `sj-${this.sjSeq}`
    this.sj.unshift({
      id,
      title: input.title.trim(),
      subject: input.subject,
      subjectName: SJ_SUBJECTS[input.subject] ?? input.subject,
      kertas: input.kertas,
      examBoard: input.examBoard,
      year: input.year,
      durationMinutes: input.durationMinutes ?? null,
      totalMarks: input.totalMarks,
      status: 'draf',
      questions: [],
      updatedAt: SJ_AT,
    })
    return { id }
  }

  async deletePaper(id: string): Promise<void> {
    await Promise.resolve()
    const i = this.sj.findIndex((p) => p.id === id)
    if (i < 0) throw new BuilderError('not_found', 'Kertas tidak ditemui')
    if (this.sj[i]!.status === 'terbit') throw new BuilderError('invalid', BIJAK_BUILDER_MESSAGES.deleteTerbitSet)
    this.sj.splice(i, 1)
  }

  /** The source route lands in a later part of S3-T06: the mock answers 404 like the server, so the page shows its error state. */
  async uploadSource(): Promise<{ batchId: string }> {
    await Promise.resolve()
    throw new BuilderError('not_found', 'Kertas tidak ditemui')
  }

  async applySource(): Promise<{ placements: number }> {
    await Promise.resolve()
    throw new BuilderError('not_found', 'Kertas tidak ditemui')
  }
}

export function createMockBuilderServer(): BuilderApi {
  return new MockBuilderServer()
}
