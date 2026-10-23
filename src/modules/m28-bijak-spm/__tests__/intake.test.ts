import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'

import { createExtractor, mockExtractor, parsePaper } from '../admin/intake/ai'
import { aiConfigFromEnv, PROVIDER_IDS } from '../admin/intake/ai/registry'
import {
  attachToStimulus,
  detachFromStimulus,
  groupLabel,
  groupsOf,
  removeStimulus,
  renumberQuestions,
} from '../admin/intake/domain/grouping'
import { schemeTotal } from '../admin/intake/domain/marks'
import { validateBatch } from '../admin/intake/domain/validation'
import { SAMPLE_PAGES } from '../admin/intake/lib/sample-paper'
import type { IntakeBatch, IntakeQuestion } from '../admin/intake/types'
import { BijakServer, MemoryStorage } from '../server/store'

const parse = () => parsePaper({ pages: SAMPLE_PAGES, subject: 'MAT', kertas: 2 })

function q(label: string, stimulusId?: string): IntakeQuestion {
  return {
    id: `q${label}`,
    label,
    type: 'short',
    stem: 's',
    options: [],
    marks: 1,
    mode: 'short_text',
    parts: [],
    tag: { subject: 'MAT', level: 'T4', unit: 'MAT-T4-02', unitLabel: 'x', sp: ['1'], tp: 2, formOrigin: 'T4' },
    page: 1,
    lowFields: [],
    confirmed: [],
    ...(stimulusId ? { stimulusId } : {}),
  }
}

describe('extractor registry (ADR 0019)', () => {
  it('defaults to the mock provider and reads env config', () => {
    expect(aiConfigFromEnv({}).provider).toBe('mock')
    expect(aiConfigFromEnv({ VITE_AI_PROVIDER: 'openai', VITE_AI_MODEL: 'm', VITE_AI_BASE_URL: 'u' })).toEqual({
      provider: 'openai',
      model: 'm',
      baseUrl: 'u',
    })
    expect(createExtractor({ provider: 'mock', model: '', baseUrl: '' })).toBe(mockExtractor)
  })

  it('every real provider is a typed stub that throws "Dikonfigurasi di pelayan"', async () => {
    for (const id of PROVIDER_IDS.filter((p) => p !== 'mock')) {
      const ex = createExtractor({ provider: id, model: 'x', baseUrl: '' })
      expect(ex.id).toBe(id)
      await expect(ex.extract({ pages: [], subject: 'MAT', kertas: 1 })).rejects.toThrow(
        'Dikonfigurasi di pelayan',
      )
    }
  })

  it('rejects an unknown provider instead of silently falling back', () => {
    expect(() => createExtractor({ provider: 'nope', model: '', baseUrl: '' })).toThrow()
  })
})

describe('mock extractor', () => {
  it('detects questions, types, marks and the stimulus group', () => {
    const r = parse()
    expect(r.questions.map((x) => x.label)).toEqual(['1', '2', '3', '4', '5'])
    expect(r.questions.map((x) => x.type)).toEqual(['short', 'mcq', 'structured', 'short', 'short'])
    expect(r.questions[1]!.options.map((o) => o.id)).toEqual(['A', 'B', 'C', 'D'])
    expect(r.questions[2]!.parts.map((p) => p.label)).toEqual(['(a)', '(b)'])
    expect(r.questions[2]!.marks).toBe(4)
    expect(r.stimuli).toHaveLength(1)
    expect(r.stimuli[0]!.label).toBe('Rajah 1')
    expect(r.questions.filter((x) => x.stimulusId).map((x) => x.label)).toEqual(['3', '4'])
    expect(new Set(r.questions.filter((x) => x.stimulusId).map((x) => x.stimulusId)).size).toBe(1)
  })

  it('reads the scheme: key, K/N points, alternatives and any-N groups', () => {
    const r = parse()
    expect(r.questions[1]!.scheme).toMatchObject({ kind: 'option', correct: 'B' })
    const q1 = r.questions[0]!.scheme
    expect(q1?.kind === 'points' && q1.points.map((p) => p.code + p.marks)).toEqual(['K1', 'N1'])
    const b = r.questions[2]!.parts[1]!.scheme
    expect(b?.kind === 'points' && b.points[0]!.match).toEqual({
      type: 'step',
      accept: ['1/2 x 6 x 8', '0.5 x 6 x 8'],
    })
    const q5 = r.questions[4]!.scheme
    expect(q5?.kind === 'points' && q5.groups?.[0]).toMatchObject({ anyN: 2 })
    expect(schemeTotal(q5)).toBe(2)
    expect(r.unmatched).toEqual([])
  })

  it('lists scheme entries for missing questions as unmatched', () => {
    const out = parsePaper({
      pages: [{ page: 1, source: 'text-layer', text: '1. Satu soalan. [1 markah]\nSkema 9\nK1 x [1]' }],
      subject: 'MAT',
      kertas: 1,
    })
    expect(out.unmatched).toEqual(['Skema 9'])
  })

  it('flags tag fields it is unsure of for a person to confirm', () => {
    const r = parse()
    expect(r.questions.every((x) => x.lowFields.length > 0)).toBe(true)
  })

  it('runs through the interface', async () => {
    const r = await mockExtractor.extract({ pages: SAMPLE_PAGES, subject: 'MAT', kertas: 2 })
    expect(r.provider).toBe('mock')
  })
})

describe('stimulus grouping', () => {
  it('attaching non-adjacent questions pulls them together', () => {
    const qs = [q('1'), q('2'), q('3'), q('4')]
    const r = attachToStimulus(qs, ['q1', 'q4'], 's1')
    // paper order is q1, q4, q2, q3 and the printed numbers follow it
    expect(r.questions.map((x) => x.id)).toEqual(['q1', 'q4', 'q2', 'q3'])
    expect(r.questions.map((x) => x.label)).toEqual(['1', '2', '3', '4'])
    expect(r.moved).toBe(true)
    const [g] = groupsOf(r.questions)
    expect(g).toMatchObject({ stimulusId: 's1', from: '1', to: '2', contiguous: true })
    expect(groupLabel(g!)).toBe('Soalan 1 - 2')
  })

  it('a share across 1, 5 and 2 renumbers so the header names the real members', () => {
    const qs = [q('1'), q('2'), q('3'), q('4'), q('5')]
    const r = attachToStimulus(qs, ['q1', 'q5', 'q2'], 's1')
    expect(r.questions.map((x) => x.id)).toEqual(['q1', 'q2', 'q5', 'q3', 'q4'])
    expect(r.questions.map((x) => x.label)).toEqual(['1', '2', '3', '4', '5'])
    const [g] = groupsOf(r.questions)
    expect(g!.labels).toEqual(['1', '2', '3'])
    expect(groupLabel(g!)).toBe('Soalan 1 - 3')
  })

  it('attaching to an existing group pulls a later question up and renumbers', () => {
    const first = attachToStimulus([q('1'), q('2'), q('3'), q('4'), q('5')], ['q3', 'q4'], 's1').questions
    const r = attachToStimulus(first, ['q1'], 's1')
    expect(r.questions.map((x) => x.id)).toEqual(['q1', 'q3', 'q4', 'q2', 'q5'])
    expect(r.questions.map((x) => x.label)).toEqual(['1', '2', '3', '4', '5'])
  })

  it('detach deals plain numbers out again when an earlier reorder left them out of sequence', () => {
    const scrambled = [q('1', 's1'), q('3', 's1'), q('4'), q('2'), q('5')]
    const r = detachFromStimulus(scrambled, ['q1'])
    expect(r.renumbered).toBe(true)
    expect(r.questions.map((x) => x.label)).toEqual(['1', '2', '3', '4', '5'])
    const ordered = detachFromStimulus([q('1', 's1'), q('2', 's1'), q('3')], ['q1'])
    expect(ordered.renumbered).toBe(false)
    expect(ordered.questions.map((x) => x.label)).toEqual(['1', '2', '3'])
  })

  it('renumberQuestions deals the numbers out in paper order and leaves unchanged objects alone', () => {
    const qs = [q('1'), q('3'), q('2')]
    const r = renumberQuestions(qs)
    expect(r.renumbered).toBe(true)
    expect(r.questions.map((x) => x.label)).toEqual(['1', '2', '3'])
    expect(r.questions[0]).toBe(qs[0])
  })

  it('a gap in the source numbering keeps its set of numbers', () => {
    const qs = [q('18'), q('19'), q('21'), q('22')]
    const r = attachToStimulus(qs, ['q18', 'q22'], 's1')
    expect(r.moved).toBe(true)
    expect(r.renumbered).toBe(true)
    expect(r.questions.map((x) => x.id)).toEqual(['q18', 'q22', 'q19', 'q21'])
    expect(r.questions.map((x) => x.label)).toEqual(['18', '19', '21', '22'])
  })

  it('free-text labels are never touched', () => {
    for (const labels of [
      ['1(a)', '2', '3'],
      ['A1', 'A2', 'A3'],
      ['', '2', '3'],
      ['7A', '7B', '8'],
    ]) {
      const qs = labels.map((l, i) => ({ ...q(l), id: `x${i}` }))
      const r = attachToStimulus(qs, ['x0', 'x2'], 's1')
      expect(r.moved).toBe(true)
      expect(r.renumbered).toBe(false)
      expect(r.questions.map((x) => x.id)).toEqual(['x0', 'x2', 'x1'])
      expect(r.questions.map((x) => x.label)).toEqual([labels[0], labels[2], labels[1]])
      expect(detachFromStimulus(r.questions, ['x0']).renumbered).toBe(false)
    }
  })

  it('duplicate numbers are never touched', () => {
    const qs = [q('1'), { ...q('2'), id: 'dup', label: '1' }, q('3')]
    const r = attachToStimulus(qs, ['q1', 'q3'], 's1')
    expect(r.moved).toBe(true)
    expect(r.renumbered).toBe(false)
    expect(r.questions.map((x) => x.label)).toEqual(['1', '3', '1'])
    expect(detachFromStimulus(r.questions, ['q1']).renumbered).toBe(false)
  })

  it('groupLabel lists the members of a group that is not contiguous', () => {
    const [g] = groupsOf([q('1', 's1'), q('2'), q('3', 's1')])
    expect(groupLabel(g!)).toBe('Soalan 1, 3')
  })

  it('adjacent questions do not move', () => {
    const r = attachToStimulus([q('1'), q('2'), q('3')], ['q2', 'q3'], 's1')
    expect(r.moved).toBe(false)
    expect(r.questions.map((x) => x.label)).toEqual(['1', '2', '3'])
  })

  it('adding to an existing group keeps one contiguous block', () => {
    const first = attachToStimulus([q('1'), q('2'), q('3'), q('4')], ['q2', 'q3'], 's1').questions
    const r = attachToStimulus(first, ['q1'], 's1')
    expect(groupsOf(r.questions)[0]!.contiguous).toBe(true)
    expect(groupsOf(r.questions)[0]!.questionIds).toHaveLength(3)
  })

  it('detach and remove clear the reference', () => {
    const grouped = attachToStimulus([q('1'), q('2')], ['q1', 'q2'], 's1').questions
    expect(groupsOf(detachFromStimulus(grouped, ['q1']).questions)[0]!.questionIds).toEqual(['q2'])
    const r = removeStimulus(
      grouped,
      [{ id: 's1', kind: 'diagram', label: 'Rajah 1', alt: 'x' }],
      's1',
    )
    expect(r.stimuli).toHaveLength(0)
    expect(groupsOf(r.questions)).toHaveLength(0)
  })

  it('the quality gate flags a non-contiguous group', () => {
    const qs = [q('1', 's1'), q('2'), q('3', 's1')]
    const issues = validateBatch({
      questions: qs,
      stimuli: [{ id: 's1', kind: 'diagram', label: 'Rajah 1', alt: 'a' }],
      source: 'x',
      copyright: 'sendiri',
    })
    expect(issues.some((i) => i.message.includes('berturutan'))).toBe(true)
  })
})

describe('intake batches on the server', () => {
  const meta = {
    subject: 'MAT',
    kertas: 2 as const,
    year: 2025,
    paperType: 'Percubaan SPM',
    source: 'Contoh',
    copyright: 'sendiri',
    notes: '',
    fileName: 'a.pdf',
    fileHash: 'h',
    pageCount: 2,
  }

  it('seeds one demo batch in Draf', async () => {
    const s = new BijakServer({ storage: new MemoryStorage() })
    const list = await s.listIntakeBatches()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ status: 'draf', questionCount: 5, groupCount: 1 })
  })

  it('accepts the reactive objects a page holds (no structuredClone)', async () => {
    const s = new BijakServer({ storage: new MemoryStorage() })
    const b = reactive(await s.getIntakeBatch('ek-demo-1'))
    await expect(s.saveExtracted(b.id, { questions: b.questions, stimuli: b.stimuli })).resolves.toBeTruthy()
  })

  it('creates, saves and gates submit-for-review (no bypass)', async () => {
    const storage = new MemoryStorage()
    const s = new BijakServer({ storage })
    const batch = await s.createIntakeBatch(1, meta, parse(), SAMPLE_PAGES)
    expect(batch.status).toBe('draf')

    const blocked = await s.submitForReview(batch.id)
    expect(blocked.ok).toBe(false)

    // fix every issue the gate reports: confirm low fields and the missing alt text
    const fixed: IntakeBatch = await s.getIntakeBatch(batch.id)
    fixed.questions = fixed.questions.map((x) => ({
      ...x,
      confirmed: [...x.lowFields],
      tag: { ...x.tag, unit: x.tag.unit ?? 'MAT-T4-02', unitLabel: 'u', sp: x.tag.sp.length ? x.tag.sp : ['1.1'] },
    }))
    fixed.stimuli = fixed.stimuli.map((x) => ({ ...x, alt: x.alt || 'Rajah segi tiga' }))
    await s.saveExtracted(batch.id, { questions: fixed.questions, stimuli: fixed.stimuli })

    const ok = await s.submitForReview(batch.id)
    expect(ok).toMatchObject({ ok: true })
    // a batch under review is read-only
    await expect(
      s.saveExtracted(batch.id, { questions: fixed.questions, stimuli: fixed.stimuli }),
    ).rejects.toMatchObject({ code: 'bad_request' })

    // persisted across a refresh
    const again = new BijakServer({ storage })
    expect((await again.getIntakeBatch(batch.id)).status).toBe('semakan')
    expect((await again.listIntakeBatches({ status: 'semakan' }))).toHaveLength(1)
  })
})
