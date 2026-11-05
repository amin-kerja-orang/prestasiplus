/**
 * In-browser mock of `BuilderApi` for `VITE_API_MODE != http`. It sits on the existing admin mock
 * (`bijakAdminServer()`: papers, blueprints and bank) and adds the builder behaviour on top: whole
 * stimulus groups on add/remove (D90), the review (blockers) and the student view. Nothing here
 * ships in the http build (see `./client`).
 */
import { BIJAK_BUILDER_MESSAGES, BIJAK_SET_BUILDER_PROPOSED, bijakDefaultLevelScope, bijakNegeriOptions, bijakNegeriSlug } from '@pp/contract'
import type {
  BijakBuilderPoolUnit,
  BijakBuilderSourceFilters,
  BijakBuilderStudentView,
  BijakDskpUnit,
  BijakLevelScope,
  BijakPoolPreview,
} from '@pp/contract'
import { scaleSectionCounts } from '@pp/exam-core'

import type { AdminPaperSummary, BuilderQuestion, PaperEditorData } from '../../../domain/admin-types'
import { addUnit, checkPaper, removeUnit, unitsOf } from '../../../domain/paper-builder'
import { kontrakServer } from '../../kontrak/server/client'
import {
  BuilderError,
  type BuilderApi,
  type BuilderSubject,
  type GenerateOptions,
  type HeaderPatch,
  type JanaFilters,
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

/**
 * The mock's stand-in for `source_papers` (fictitious): a stable year and Negeri per question id, so the Tahun and Negeri filters and the origin chips can
 * be exercised without a server. A group takes the value of its first member, so it matches as one unit.
 */
const MOCK_YEARS = [2025, 2024, 2023, 2022, 2021]
const MOCK_NEGERI = ['Johor', 'Kedah', 'Kelantan', 'Melaka', 'Perak', 'MRSM', 'SBP']
const hashOf = (text: string): number => [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7)
const originOf = (id: string): { year: number; negeri: string } => ({
  year: MOCK_YEARS[hashOf(id) % MOCK_YEARS.length]!,
  negeri: MOCK_NEGERI[(hashOf(id) >>> 3) % MOCK_NEGERI.length]!,
})
const originMatches = (id: string, years: readonly number[], negeri: readonly string[]): boolean => {
  const o = originOf(id)
  return (!years.length || years.includes(o.year)) && (!negeri.length || negeri.some((n) => bijakNegeriSlug(n) === bijakNegeriSlug(o.negeri)))
}
const filtersOf = (ids: readonly string[]): BijakBuilderSourceFilters => ({
  years: [...new Set(ids.map((id) => originOf(id).year))].sort((a, b) => b - a),
  negeri: bijakNegeriOptions(ids.map((id) => originOf(id).negeri)),
})

/** Fields of the wire the mock paper does not keep on its own type. */
type MockPaper = PaperEditorData['paper'] & { levelScope?: BijakLevelScope | null }

/** Contract code of a hard blocker line (BM text of `checkPaper`); the mock only needs a stable code. */
function hardCode(message: string): 'COUNT_TOO_FEW' | 'COUNT_TOO_MANY' | 'MARKS_MISMATCH' | 'NOT_PUBLISHED' | 'DUPLICATE_QUESTION' | 'GROUP_INCOMPLETE' {
  if (/Lebih \d+ soalan/.test(message)) return 'COUNT_TOO_MANY'
  if (/^.*Markah /.test(message)) return 'MARKS_MISMATCH'
  if (/belum Terbit/.test(message)) return 'NOT_PUBLISHED'
  if (/berulang/.test(message)) return 'DUPLICATE_QUESTION'
  if (/tidak lengkap/.test(message)) return 'GROUP_INCOMPLETE'
  return 'COUNT_TOO_FEW'
}

export class MockBuilderServer implements BuilderApi {
  constructor(private readonly overridable: OverridableLines = blueprintLines) {}
  private admin: Promise<AdminMock> | null = null
  private a(): Promise<AdminMock> {
    this.admin ??= loadAdmin()
    return this.admin
  }

  /** The mock's editor with what the API adds on the wire: pinned and servable of a placed question (API-BIJAK-10 (g)). */
  private withChips(ed: PaperEditorData): PaperEditorData {
    const placed = new Set(ed.paper.sections.flatMap((s) => s.questionIds))
    const locked = ed.paper.status === 'terbit'
    return {
      ...ed,
      // The mock's paper is a live object, changed outside Vue: a copy per answer, so the page sees the change.
      paper: JSON.parse(JSON.stringify(ed.paper)) as PaperEditorData['paper'],
      questions: ed.questions.map((q) =>
        placed.has(q.id)
          ? { ...q, pinned: locked, servable: locked || q.status === 'terbit', ...(locked || q.status === 'terbit' ? {} : { notServedReason: 'Soalan ini belum diluluskan.' }) }
          : q,
      ),
    }
  }

  async listSets(): Promise<AdminPaperSummary[]> {
    const a = await this.a()
    const rows = await a.listAdminPapers()
    return Promise.all(
      rows.map(async (row) => {
        const paper = (await a.getPaperEditor(row.id)).paper as MockPaper
        const counts = new Map<string, number>()
        for (const id of paper.sections.flatMap((s) => s.questionIds)) counts.set(originOf(id).negeri, (counts.get(originOf(id).negeri) ?? 0) + 1)
        return {
          ...row,
          levelScope: paper.levelScope ?? null,
          origins: [...counts.entries()].map(([negeri, count]) => ({ negeri, count })).sort((x, y) => y.count - x.count || x.negeri.localeCompare(y.negeri, 'ms')),
        }
      }),
    )
  }

  async builderSubjects(): Promise<BuilderSubject[]> {
    const rows = await (await this.a()).listBlueprints()
    const out = new Map<string, BuilderSubject>()
    for (const b of rows) {
      const s = out.get(b.subject) ?? { code: b.subject, name: b.subjectName, kertas: [], levelScopes: {} }
      if (!s.kertas.includes(b.kertas)) s.kertas.push(b.kertas)
      s.levelScopes![b.kertas] = bijakDefaultLevelScope((b as { levelShare?: { t4: number; t5: number } | null }).levelShare)
      out.set(b.subject, s)
    }
    return [...out.values()]
  }

  async create(input: { subject: string; kertas: number; title?: string; levelScope?: BijakLevelScope }): Promise<string> {
    const a = await this.a()
    const id = await a.createPaper({
      subject: input.subject,
      kertas: input.kertas as 1 | 2,
      ...(input.title ? { title: input.title } : {}),
    })
    const ed = await a.getPaperEditor(id)
    ;(ed.paper as MockPaper).levelScope = input.levelScope ?? 't4_t5'
    await a.savePaper(id, {})
    return id
  }

  /** The mock's Jana set (API-BIJAK-11): the sections of the contract at the size asked, filled from the bank, a group whole or not at all. */
  async generate(subject: string, kertas: number, options: GenerateOptions = {}): Promise<string> {
    const { paperId } = await kontrakServer().generateDraft(subject, kertas)
    const a = await this.a()
    const ed = await a.getPaperEditor(paperId)
    const total = ed.paper.sections.reduce((n, s) => n + s.questionCount, 0)
    const count = options.count ?? total
    if (count > total) throw new BuilderError('invalid', BIJAK_SET_BUILDER_PROPOSED.countAboveContract(total))
    const shares = scaleSectionCounts(ed.paper.sections.map((s) => s.questionCount), count)
    const used = new Set<string>()
    const fill: { id: string; questionIds: string[] }[] = []
    for (const [i, s] of ed.paper.sections.entries()) {
      const want = shares[i]!
      const picked: string[] = []
      const { units } = await this.pool(paperId, s.id, { pageSize: 5000, ...(options.negeri?.length ? { negeri: options.negeri } : {}) })
      for (const u of units) {
        if (picked.length >= want) break
        if (picked.length + u.questionIds.length > want || u.questionIds.some((q) => used.has(q))) continue
        if (options.years?.length && !u.questionIds.some((q) => originMatches(q, options.years!, []))) continue
        picked.push(...u.questionIds)
      }
      picked.forEach((q) => used.add(q))
      fill.push({ id: s.id, questionIds: picked })
    }
    // A scaled set keeps the size it was drawn at, and leaves out a section with no share. Its budget is what the draw adds up to.
    if (count < total) {
      const paper = ed.paper
      const marks = new Map((await Promise.all(paper.sections.map((s) => this.pool(paperId, s.id, { pageSize: 5000 })))).flatMap((p) => p.units.flatMap((u) => u.questions.map((q) => [q.id, q.marks] as const))))
      paper.sections.forEach((s, i) => {
        s.questionCount = shares[i]!
        s.markBudget = fill[i]!.questionIds.reduce((n, q) => n + (marks.get(q) ?? 0), 0)
      })
      paper.sections = paper.sections.filter((s) => s.questionCount > 0)
    }
    const paper = ed.paper as MockPaper
    paper.levelScope = options.levelScope ?? 't4_t5'
    await a.savePaper(paperId, {
      ...(options.title?.trim() ? { title: options.title.trim() } : {}),
      sections: fill.filter((f) => ed.paper.sections.some((s) => s.id === f.id)),
    })
    return paperId
  }

  async poolPreview(subject: string, kertas: number, filters: JanaFilters = {}): Promise<BijakPoolPreview> {
    const base = await kontrakServer().pool(subject, kertas)
    const contractTotal = base.sections.reduce((n, s) => n + s.slots, 0)
    const bank = await this.bankIdsOf(subject, kertas)
    const shrink = (filters.years?.length ? filters.years.length / MOCK_YEARS.length : 1) * (filters.negeri?.length ? filters.negeri.length / MOCK_NEGERI.length : 1)
    const eligibleTotal = Math.floor(base.eligibleTotal * shrink)
    const asked = filters.count ?? contractTotal
    return {
      ...base,
      eligibleTotal,
      verdict: base.verdict === 'boleh' && asked > eligibleTotal ? 'tidak_boleh' : base.verdict,
      contractTotal,
      groupTotal: 1,
      filters: filtersOf(bank),
      levelScope: 't4_t5',
    }
  }

  /** The bank ids of a subject and kertas, for the filter values of the mock. */
  private async bankIdsOf(subject: string, kertas: number): Promise<string[]> {
    const a = await this.a()
    const id = await a.createPaper({ subject, kertas: kertas as 1 | 2, title: 'pratonton' })
    try {
      const ed = await a.getPaperEditor(id)
      const sid = ed.paper.sections[0]?.id
      return sid ? (await a.sectionPool(id, sid, { pageSize: 5000 })).units.flatMap((u) => u.questionIds) : []
    } finally {
      await a.deletePaper(id)
    }
  }

  async deleteSet(id: string): Promise<void> {
    await (await this.a()).deletePaper(id)
  }

  async getEditor(id: string): Promise<PaperEditorData> {
    return this.withChips(await (await this.a()).getPaperEditor(id))
  }

  async updateHeader(id: string, patch: HeaderPatch): Promise<PaperEditorData> {
    const a = await this.a()
    const { instructions, code, ...rest } = patch
    const ed = await a.getPaperEditor(id)
    // The mock hands out its live paper object: instructions and the code are set on it, then saved to persist.
    if (instructions && ed.paper.status !== 'terbit') ed.paper.instructions = [...instructions]
    if (code !== undefined && ed.paper.status !== 'terbit') ed.paper.code = code || ed.paper.subject
    return this.withChips(await a.savePaper(id, rest))
  }

  private async mutate(id: string, sectionId: string, fn: (ids: string[], ed: PaperEditorData) => string[]): Promise<PaperEditorData> {
    const a = await this.a()
    const ed = await a.getPaperEditor(id)
    if (ed.paper.status === 'terbit') throw new BuilderError('invalid', LOCKED)
    const sec = ed.paper.sections.find((s) => s.id === sectionId)
    if (!sec) throw new BuilderError('invalid', 'Bahagian tidak sah')
    return this.withChips(await a.savePaper(id, { sections: [{ id: sectionId, questionIds: fn([...sec.questionIds], ed) }] }))
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
    const all: string[] = []
    for (const q of ed.questions) {
      if (q.status !== 'terbit' || done.has(q.id)) continue
      const ids = q.groupId ? h.membersOf(q.groupId) : [q.id]
      ids.forEach((x) => done.add(x))
      const qs = ids.map((x) => h.q.get(x)).filter((x): x is BuilderQuestion => !!x)
      all.push(...ids)
      if (term && !qs.some((x) => `${x.preview} ${x.topic} ${x.id}`.toLowerCase().includes(term))) continue
      if (!ids.some((x) => originMatches(x, query.tahun === undefined ? [] : [query.tahun], query.negeri ?? []))) continue
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
      filters: filtersOf(all),
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
    const rule = patch.rule ?? sec.rule
    if ((patch.compulsory ?? sec.compulsory) && rule.type === 'choose' && (patch.rule !== undefined || patch.compulsory !== undefined)) {
      throw new BuilderError('invalid', BIJAK_BUILDER_MESSAGES.compulsoryChoose)
    }
    if (patch.compulsory !== undefined) sec.compulsory = patch.compulsory
    if (patch.rule !== undefined) sec.rule = patch.rule
    // The mock hands out its live paper: saving persists it.
    return this.withChips(await a.savePaper(id, {}))
  }

  async updateReference(id: string, panels: ReferencePanel[]): Promise<PaperEditorData> {
    const a = await this.a()
    const ed = await a.getPaperEditor(id)
    if (ed.paper.status === 'terbit') throw new BuilderError('invalid', LOCKED)
    if (panels.some((p) => !p.title.trim())) throw new BuilderError('invalid', 'Tajuk panel diperlukan')
    ;(ed.paper as unknown as { reference: ReferencePanel[] }).reference = panels.map((p) => ({ ...p, items: [...p.items] }))
    return this.withChips(await a.savePaper(id, {}))
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
    return this.withChips(await a.savePaper(id, {}))
  }

  async withdraw(id: string): Promise<void> {
    await (await this.a()).unpublishPaper(id)
  }

  async copy(id: string): Promise<string> {
    const a = await this.a()
    const ed = await a.getPaperEditor(id)
    const newId = await a.createPaper({ subject: ed.paper.subject, kertas: ed.paper.kertas, title: `${ed.paper.title} (Salinan)` })
    ;((await a.getPaperEditor(newId)).paper as MockPaper).levelScope = (ed.paper as MockPaper).levelScope ?? null
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
