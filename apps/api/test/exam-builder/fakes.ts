import type { BijakAttemptStimulus, BijakBuilderQuestionStatus } from '@pp/contract'

import type { BijakQuestionInfo, BijakQuestionSource } from '../../src/modules/bijak/papers'
import type {
  BuilderCandidateScope,
  BuilderGroupInfo,
  BuilderPreview,
  BuilderQuestionInfo,
  BuilderQuestionRef,
  BuilderQuestionSource,
} from '../../src/modules/exam/builder'

export interface FakeQuestionInit {
  id: string
  subject?: string
  kertas?: number
  marks: number
  groupId?: string
  status?: BijakBuilderQuestionStatus
}

interface FakeQuestion {
  id: string
  subject: string
  kertas: number
  groupId: string | null
  status: BijakBuilderQuestionStatus
  /** versions[n - 1] = the version n content. */
  versions: { marks: number; preview: string }[]
}

/**
 * In-memory question bank for the builder tests. It implements the builder port and BE-15's student
 * port over the same data, so both sides stay in step. A question edit creates version n + 1 and keeps
 * the older versions readable (`describe({ id, versionNo })`).
 */
export class FakeBank implements BuilderQuestionSource, BijakQuestionSource {
  private readonly questions = new Map<string, FakeQuestion>()
  private readonly groupDefs = new Map<string, string[]>()

  add(init: FakeQuestionInit): this {
    this.questions.set(init.id, {
      id: init.id,
      subject: init.subject ?? 'MAT',
      kertas: init.kertas ?? 2,
      groupId: init.groupId ?? null,
      status: init.status ?? 'approved',
      versions: [{ marks: init.marks, preview: `Soalan ${init.id} v1` }],
    })
    return this
  }

  addGroup(groupId: string, questionIds: string[]): this {
    this.groupDefs.set(groupId, questionIds)
    return this
  }

  /** Edits a question: version n + 1 with the new marks. */
  edit(id: string, change: { marks: number }): number {
    const q = this.must(id)
    q.versions.push({ marks: change.marks, preview: `Soalan ${id} v${String(q.versions.length + 1)}` })
    return q.versions.length
  }

  setStatus(id: string, status: BijakBuilderQuestionStatus): void {
    this.must(id).status = status
  }

  private must(id: string): FakeQuestion {
    const q = this.questions.get(id)
    if (!q) throw new Error(`fake bank: unknown question ${id}`)
    return q
  }

  private infoOf(q: FakeQuestion, versionNo?: number): BuilderQuestionInfo {
    const n = versionNo !== undefined && versionNo >= 1 && versionNo <= q.versions.length ? versionNo : q.versions.length
    const v = q.versions[n - 1]!
    return {
      id: q.id,
      versionNo: n,
      status: q.status,
      subject: q.subject,
      kertas: q.kertas,
      groupId: q.groupId,
      ...(q.groupId ? { stimulusLabel: `Rajah ${q.groupId}` } : {}),
      preview: v.preview,
      marks: v.marks,
      kind: 'berstruktur',
      topic: 'Topik ujian',
    }
  }

  // --- BuilderQuestionSource ---------------------------------------------------------------------

  async describe(refs: readonly BuilderQuestionRef[]): Promise<ReadonlyMap<string, BuilderQuestionInfo>> {
    const out = new Map<string, BuilderQuestionInfo>()
    for (const ref of refs) {
      const q = this.questions.get(ref.id)
      if (q) out.set(ref.id, this.infoOf(q, ref.versionNo))
    }
    return out
  }

  async candidates(scope: BuilderCandidateScope): Promise<string[]> {
    return [...this.questions.values()]
      .filter((q) => q.subject === scope.subject && q.kertas === scope.kertas && q.status === 'approved')
      .map((q) => q.id)
  }

  async groups(groupIds: readonly string[]): Promise<ReadonlyMap<string, BuilderGroupInfo>> {
    const out = new Map<string, BuilderGroupInfo>()
    for (const id of groupIds) {
      const members = this.groupDefs.get(id)
      if (!members) continue
      const stimulus: BijakAttemptStimulus = { id: `s${id}`, kind: 'passage', label: `Rajah ${id}`, alt: 'Rangsangan ujian', text: 'Teks rangsangan.' }
      out.set(id, { id, stimulus, questionIds: members })
    }
    return out
  }

  async review(ids: readonly string[]): Promise<BuilderPreview> {
    const questions = ids.flatMap((id) => {
      const q = this.questions.get(id)
      if (!q) return []
      const v = q.versions[q.versions.length - 1]!
      return [
        {
          id,
          stem: v.preview,
          marks: v.marks,
          curriculum: { subject: q.subject, level: 'T4' as const, unit: null, unitLabel: 'Topik ujian', sp: [], tp: 1, formOrigin: 'T4' as const },
          scheme: { [id]: null },
        },
      ]
    })
    return { questions, stimuli: {}, optionBanks: {} }
  }

  // --- BijakQuestionSource (BE-15, student side) -------------------------------------------------

  async getMany(ids: readonly string[]): Promise<ReadonlyMap<string, BijakQuestionInfo>> {
    const out = new Map<string, BijakQuestionInfo>()
    for (const id of ids) {
      const q = this.questions.get(id)
      if (q) out.set(id, { id, marks: q.versions[q.versions.length - 1]!.marks, groupId: q.groupId, versionNo: q.versions.length })
    }
    return out
  }

  async pool(): Promise<{ entries: { questionId: string; groupId?: string }[]; groups: ReadonlyMap<string, readonly string[]> }> {
    return { entries: [], groups: new Map() }
  }
}

/**
 * The MAT kertas 2 bank (blueprint 1449/2: Bahagian A 3 questions / 3 marks, Bahagian B 1 / 1,
 * Bahagian C choose 1 of 2 / 2 marks).
 *   700001-700004  1 mark       700005, 700006  2 marks (Bahagian C)
 *   700007 1 mark, 700008 2 marks, 700009 1 mark (spares)
 *   700010 1 mark, draft        700011 1 mark, subject SN
 *   700021, 700022  1 mark, stimulus group 800001
 */
export function matBank(): FakeBank {
  const bank = new FakeBank()
  for (const id of ['700001', '700002', '700003', '700004']) bank.add({ id, marks: 1 })
  for (const id of ['700005', '700006']) bank.add({ id, marks: 2 })
  bank.add({ id: '700007', marks: 1 }).add({ id: '700008', marks: 2 }).add({ id: '700009', marks: 1 })
  bank.add({ id: '700010', marks: 1, status: 'draft' })
  bank.add({ id: '700011', marks: 1, subject: 'SN' })
  bank.add({ id: '700021', marks: 1, groupId: '800001' }).add({ id: '700022', marks: 1, groupId: '800001' })
  bank.addGroup('800001', ['700021', '700022'])
  return bank
}
