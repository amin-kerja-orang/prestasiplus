/**
 * In-browser mock of `BuilderApi` for `VITE_API_MODE != http`. It sits on the existing admin mock
 * (`bijakAdminServer()`: papers, blueprints and bank) and adds the builder behaviour on top: whole
 * stimulus groups on add/remove (D90), the review (blockers) and the student view. Nothing here
 * ships in the http build (see `./client`).
 */
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
 * "Kontrak Simulasi ... belum Disahkan") for a paper. The default mock has none, so the mock e2e
 * keeps its 2-click publish.
 */
export type OverridableLines = (editor: PaperEditorData) => string[]

export class MockBuilderServer implements BuilderApi {
  constructor(private readonly overridable: OverridableLines = () => []) {}
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

  async getEditor(id: string): Promise<PaperEditorData> {
    return (await this.a()).getPaperEditor(id)
  }

  async updateHeader(id: string, patch: HeaderPatch): Promise<PaperEditorData> {
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
    const overridableLines = this.overridable(ed)
    const blockers = [...check.errors, ...check.sections.flatMap((s) => s.errors.map((e) => `${s.label}: ${e}`))]
    const notes = check.sections.flatMap((s) => s.notes.map((n) => `${s.label}: ${n}`))
    return {
      paperId: id,
      status: ed.paper.status,
      ok: blockers.length === 0 && overridableLines.length === 0,
      blockers: [...blockers, ...overridableLines.map((message) => ({ code: 'CONTRACT', message, overridable: true }))],
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
          s.instruction ?? (s.rule.type === 'all' ? 'Jawab semua soalan.' : `Jawab ${s.rule.n} daripada ${s.questionCount} soalan.`),
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
    if (options.override && (options.reason ?? '').trim().length < 5)
      throw new BuilderError('invalid', 'Sebab diperlukan untuk menerbitkan walaupun tidak memenuhi kontrak blueprint')
    const a = await this.a()
    const lines = this.overridable(await a.getPaperEditor(id))
    if (lines.length && !options.override) return { ok: false, errors: lines }
    const r = await a.publishPaper(id)
    return { ok: r.ok, errors: r.errors, ...(r.ok && lines.length ? { overridden: lines } : {}) }
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
    g.stimulus.label = label.trim()
    return a.savePaper(id, {})
  }

  async withdraw(id: string): Promise<void> {
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
}

export function createMockBuilderServer(): BuilderApi {
  return new MockBuilderServer()
}
