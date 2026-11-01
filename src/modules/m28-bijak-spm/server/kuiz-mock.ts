/**
 * Mock side of Simulasi Kuiz (R1-B16), mirroring the shapes of `/api/bijak/kuiz/*`. It draws from the
 * curated seed papers (objective questions only); a random quiz is kept in memory for the tab, the
 * per-paper quiz stores nothing. The key never leaves this class except in a check verdict.
 * Lives apart from `store.ts` so the http build never bundles it.
 */
import { BIJAK_KUIZ_MESSAGES } from '@pp/contract'
import type {
  BijakKuizCheckRequest,
  BijakKuizCheckResult,
  BijakKuizItem,
  BijakKuizPaperPage,
  BijakKuizResult,
  BijakKuizSession,
  BijakKuizStartRequest,
} from '@pp/contract'

import { BANK, PAPERS, subjectName } from '../data/registry'
import { leavesOf } from '../domain/paper-model'
import type { QuestionDef } from '../domain/types'
import { parseCount } from '../lib/kuiz-count'
import { BijakError } from './errors'

const LETTERS = 'ABCDEFGH'

interface Session {
  items: Map<string, { correctId: string; optionIds: Set<string> }>
  verdicts: Map<string, BijakKuizCheckResult>
  done: boolean
  total: number
}

function shuffle<T>(list: T[]): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

function stimuliOf(q: QuestionDef): BijakKuizItem['stimuli'] {
  const group = q.groupId ? BANK.groups.get(q.groupId) : undefined
  const st = group ? BANK.stimuli.get(group.stimulusId) : undefined
  if (!st) return []
  // All seven kinds go out as they are, with caption, source and table (R1-T07), like the API.
  return [
    {
      kind: st.kind,
      label: st.label,
      body: st.text ?? null,
      imageToken: null,
      alt: st.alt,
      caption: st.caption ?? null,
      source: st.source ?? null,
      table: st.table ? { head: st.table.head, rows: st.table.rows } : null,
    },
  ]
}

/** One MCQ question as an item; option ids are the stored letters, labels follow the shuffled order. */
function mcqItem(q: QuestionDef): { item: BijakKuizItem; correctId: string } | null {
  const options = q.mcq?.options
  const scheme = BANK.schemes.get(q.id)
  if (!options || scheme?.kind !== 'option') return null
  const lettered = options.map((o, i) => ({ id: LETTERS[i]!, src: o.id, text: o.text }))
  const correctId = lettered.find((o) => o.src === scheme.correct)?.id
  if (!correctId) return null
  return {
    correctId,
    item: {
      id: q.id,
      groupId: q.groupId ?? null,
      kind: 'mcq',
      stem: q.stem,
      lead: [],
      path: null,
      prompt: '',
      marks: scheme.marks,
      markable: true,
      subjectName: subjectName(q.curriculum.subject),
      stimuli: stimuliOf(q),
      options: shuffle(lettered).map((o, i) => ({
        id: o.id,
        label: LETTERS[i]!,
        text: o.text,
        imageToken: null,
      })),
    },
  }
}

export class MockKuiz {
  private readonly sessions = new Map<string, Session>()
  private seq = 0

  constructor(private readonly tick: () => Promise<void>) {}

  async start(input: BijakKuizStartRequest): Promise<BijakKuizSession> {
    await this.tick()
    const count = parseCount(input.count)
    const pool = new Map<string, QuestionDef>()
    for (const p of PAPERS)
      for (const s of p.sections)
        for (const id of s.questionIds) {
          const q = BANK.questions.get(id)
          if (q?.mcq && (!input.subject || q.curriculum.subject === input.subject)) pool.set(id, q)
        }
    const drawn = shuffle([...pool.values()])
      .map(mcqItem)
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .slice(0, count)
    if (!drawn.length) throw new BijakError('no_questions', 'Belum ada soalan objektif')
    const sessionId = `00000000-0000-4000-8000-${String(++this.seq).padStart(12, '0')}`
    this.sessions.set(sessionId, {
      items: new Map(
        drawn.map((d) => [
          d.item.id,
          { correctId: d.correctId, optionIds: new Set(d.item.options.map((o) => o.id)) },
        ]),
      ),
      verdicts: new Map(),
      done: false,
      total: drawn.length,
    })
    return { sessionId, count: drawn.length, items: drawn.map((d) => d.item) }
  }

  async check(sessionId: string, input: BijakKuizCheckRequest): Promise<BijakKuizCheckResult> {
    await this.tick()
    const s = this.sessions.get(sessionId)
    if (!s) throw new BijakError('not_found', 'Kuiz tidak ditemui')
    if (s.done) throw new BijakError('bad_request', 'Kuiz ini sudah selesai.')
    const known = s.verdicts.get(input.itemId)
    if (known) return known
    const item = s.items.get(input.itemId)
    if (!item || !item.optionIds.has(input.optionId))
      throw new BijakError('bad_request', 'Jawapan tidak sah.')
    const scheme = BANK.schemes.get(input.itemId)
    const result: BijakKuizCheckResult = {
      correct: input.optionId === item.correctId,
      correctOptionId: item.correctId,
      explanation: scheme?.kind === 'option' ? scheme.reason : null,
    }
    s.verdicts.set(input.itemId, result)
    return result
  }

  async finish(sessionId: string): Promise<BijakKuizResult> {
    await this.tick()
    const s = this.sessions.get(sessionId)
    if (!s) throw new BijakError('not_found', 'Kuiz tidak ditemui')
    if (s.done) throw new BijakError('bad_request', 'Kuiz ini sudah selesai.')
    s.done = true
    const score = [...s.verdicts.values()].filter((v) => v.correct).length
    return {
      score,
      total: s.total,
      answered: s.verdicts.size,
      gamification: {
        coinsEarned: score * 2,
        streakCount: 1,
        pointsEarned: score * 10,
        totalBalance: score * 2,
      },
    }
  }

  /* ----------------------------------------------------------------------- per paper */

  private paper(paperId: string) {
    const p = PAPERS.find((x) => x.id === paperId)
    if (!p) throw new BijakError('not_found', 'Kertas tidak ditemui')
    // Like the API (H-A13): a paper that places a question the bank no longer serves, or none at all, is refused.
    const placed = p.sections.flatMap((s) => s.questionIds)
    if (placed.length === 0 || placed.some((id) => !BANK.questions.has(id)))
      throw new BijakError('forbidden', BIJAK_KUIZ_MESSAGES.paperUnavailable)
    return p
  }

  private itemsOf(ids: string[]): BijakKuizItem[] {
    const out: BijakKuizItem[] = []
    for (const id of ids) {
      const q = BANK.questions.get(id)
      if (!q) continue
      const m = mcqItem(q)
      if (m) {
        out.push(m.item)
        continue
      }
      for (const leaf of leavesOf(q.parts ?? []))
        out.push({
          id: `${q.id}:${leaf.id}`,
          groupId: q.groupId ?? null,
          kind: 'open',
          stem: q.stem,
          lead: [],
          path: leaf.label,
          prompt: leaf.prompt,
          marks: leaf.marks,
          markable: false,
          subjectName: subjectName(q.curriculum.subject),
          stimuli: stimuliOf(q),
          options: [],
        })
    }
    return out
  }

  async paperPage(paperId: string, page: number): Promise<BijakKuizPaperPage> {
    await this.tick()
    const p = this.paper(paperId)
    const sections = p.sections.filter((s) => this.itemsOf(s.questionIds).length > 0)
    const markableTotal = p.sections.reduce(
      (n, s) => n + this.itemsOf(s.questionIds).filter((i) => i.markable).length,
      0,
    )
    // Like the API (422 on a page outside 1..pageCount); a paper with nothing to show has only page 1.
    if (!Number.isInteger(page) || page < 1 || page > Math.max(1, sections.length))
      throw new BijakError('bad_request', 'Nilai tidak sah.')
    const s = sections[page - 1] ?? null
    // D90: a stimulus group is sent once in `groups`; its members follow each other and carry no stimulus.
    const raw = s ? this.itemsOf(s.questionIds) : []
    const groups: BijakKuizPaperPage['groups'] = []
    const items: BijakKuizItem[] = []
    for (const it of raw) {
      if (it.groupId === null) {
        items.push(it)
      } else if (!groups.some((g) => g.id === it.groupId)) {
        groups.push({ id: it.groupId, stimuli: it.stimuli })
        for (const m of raw.filter((x) => x.groupId === it.groupId)) items.push({ ...m, stimuli: [] })
      }
    }
    return {
      paper: { id: p.id, title: p.title, subjectName: subjectName(p.subject), code: p.code },
      page,
      pageCount: sections.length,
      section: s ? { id: s.id, label: s.label, instruction: s.instruction ?? null } : null,
      items,
      groups,
      markableTotal,
    }
  }

  async checkPaper(paperId: string, input: BijakKuizCheckRequest): Promise<BijakKuizCheckResult> {
    await this.tick()
    const p = this.paper(paperId)
    const inPaper = p.sections.some((s) => s.questionIds.includes(input.itemId))
    const q = inPaper ? BANK.questions.get(input.itemId) : undefined
    const scheme = BANK.schemes.get(input.itemId)
    const options = q?.mcq?.options
    if (
      !q ||
      !options ||
      scheme?.kind !== 'option' ||
      !LETTERS.slice(0, options.length).includes(input.optionId)
    )
      throw new BijakError('bad_request', 'Jawapan tidak sah.')
    const correctId = LETTERS[options.findIndex((o) => o.id === scheme.correct)]!
    return {
      correct: input.optionId === correctId,
      correctOptionId: correctId,
      explanation: scheme.reason,
    }
  }
}
