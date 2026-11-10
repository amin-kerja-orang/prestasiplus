import { AiExtractedPaperSchema, AiExtractRequestSchema, type AiExtractRequest } from '@pp/contract'
import { ConfigService } from '@nestjs/config'
import { describe, expect, it } from 'vitest'

import { AiConfig } from '../../src/modules/ai-extraction/ai.config'
import { MockProvider } from '../../src/modules/ai-extraction/providers/mock/mock.provider'
import { segmentPaper } from '../../src/modules/ai-extraction/providers/paper-segmenter'
import { createProvider } from '../../src/modules/ai-extraction/providers/registry'
import { SegmenterProvider } from '../../src/modules/ai-extraction/providers/segmenter.provider'
import { SAMPLE_EXPECTED, SAMPLE_PAGE_1, SAMPLE_PAGE_2 } from '../intake-files/sample-paper'

function request(pages: string[][]): AiExtractRequest {
  return AiExtractRequestSchema.parse({
    pages: pages.map((l, i) => ({ page: i + 1, text: l.join('\n'), source: 'text-layer' })),
    subject: 'SN',
    kertas: 1,
  })
}

describe('segmentPaper on a real-layout paper', () => {
  const paper = segmentPaper(request([SAMPLE_PAGE_1, SAMPLE_PAGE_2]))

  it('finds every question and splits options A to E in order', () => {
    expect(paper.questions.map((q) => q.label)).toEqual(['1', '2', '3', '4', '5', '6'])
    for (const q of paper.questions) {
      expect(q.type).toBe('mcq')
      expect(q.options.length).toBe(SAMPLE_EXPECTED.options[q.label])
      expect(q.options.map((o) => o.id)).toEqual(['A', 'B', 'C', 'D', 'E'].slice(0, q.options.length))
    }
    expect(paper.questions[0]?.options[1]).toEqual({ id: 'B', text: 'Newton' })
    expect(paper.questions[3]?.options.map((o) => o.text)).toEqual(['8 cm2', '16 cm2', '24 cm2', '32 cm2'])
    expect(paper.questions[0]?.stem).toBe('Apakah unit SI bagi daya?')
  })

  it('drops page furniture and reads the answer key', () => {
    expect(JSON.stringify(paper)).not.toMatch(/SULIT|4531|Lihat halaman/)
    for (const q of paper.questions) expect(q.scheme).toMatchObject({ kind: 'option', correct: SAMPLE_EXPECTED.key[q.label] })
    expect(paper.unmatched).toEqual([])
  })

  it('groups rajah as stimuli, never as questions, and links every question that refers to one', () => {
    expect(paper.stimuli.map((s) => s.label)).toEqual(SAMPLE_EXPECTED.stimuli)
    const label = new Map(paper.stimuli.map((s) => [s.id, s.label]))
    for (const q of paper.questions) {
      expect(q.stimulusId ? label.get(q.stimulusId) : undefined, `question ${q.label}`).toBe(SAMPLE_EXPECTED.stimulus[q.label])
    }
    // A caption line never becomes a stem or an option.
    expect(paper.questions.some((q) => q.stem === 'Rajah 1' || q.options.some((o) => /^Rajah \d/.test(o.text)))).toBe(false)
    // The rajah that is only mentioned is flagged for review.
    expect(paper.warnings.some((w) => w.includes('Rajah 3'))).toBe(true)
  })

  it('reports its own model and is a valid draft paper', () => {
    expect(paper.model).toBe('segmenter-1')
    expect(AiExtractedPaperSchema.omit({ usage: true, redaction: true }).safeParse(paper).success).toBe(true)
  })
})

describe('segmentPaper edge cases', () => {
  it('does not treat a stem line starting with a letter-dot as an option out of order', () => {
    const p = segmentPaper(request([['1. Siapakah penemu?', 'B. Ahmad dalam cerita ini', 'A. Satu', 'B. Dua']]))
    expect(p.questions[0]?.options.map((o) => o.id)).toEqual(['A', 'B'])
    expect(p.questions[0]?.stem).toContain('B. Ahmad')
  })

  it('reads numbers without a dot only when they are the next number', () => {
    const p = segmentPaper(request([['1 Berapakah 2 + 3?', 'A. 4', 'B. 5', '2 Berapakah 3 + 3?', 'A. 6', 'B. 7', '9 Bukan soalan baharu']]))
    expect(p.questions.map((q) => q.label)).toEqual(['1', '2'])
    expect(p.questions[1]?.options[1]?.text).toContain('9 Bukan')
  })

  it('joins an option that wraps onto the next line and a stem that spans lines', () => {
    const p = segmentPaper(request([['1. Pilih jawapan yang', 'paling tepat.', 'A. Pilihan pertama', 'yang panjang', 'B. Kedua']]))
    expect(p.questions[0]?.stem).toBe('Pilih jawapan yang paling tepat.')
    expect(p.questions[0]?.options[0]?.text).toBe('Pilihan pertama yang panjang')
  })

  it('splits options that OCR joined into the stem line, without spaces after the letter', () => {
    const p = segmentPaper(request([['3. Apakah nilai X pada Rajah 2? A.2 cm B.4 cm C.6cm D.8cm E.10 cm', '4. Luas? A.8cm2 B.16cm2 C.24cm2 D.32cm2']]))
    expect(p.questions[0]?.stem).toBe('Apakah nilai X pada Rajah 2?')
    expect(p.questions[0]?.options.map((o) => o.text)).toEqual(['2 cm', '4 cm', '6cm', '8cm', '10 cm'])
    expect(p.questions[1]?.options.map((o) => o.id)).toEqual(['A', 'B', 'C', 'D'])
  })

  it('does not read a decimal measurement ("2.5 cm") as question 2', () => {
    const p = segmentPaper(request([['2.5 cm', '1. Panjang pensel ialah 2.5 cm.', 'A. 2', 'B. 3', '2.5 cm ialah panjang tali.']]))
    expect(p.questions.map((q) => q.label)).toEqual(['1'])
  })

  it('still reads "2. Rajah ..." and "2) Rajah ..." as question 2', () => {
    const p = segmentPaper(request([['1. Satu?', 'A. a', 'B. b', '2. Rajah 1 menunjukkan graf.', 'A. c', 'B. d', '3) Tiga?', 'A. e', 'B. f']]))
    expect(p.questions.map((q) => q.label)).toEqual(['1', '2', '3'])
    expect(p.questions[1]?.stem).toContain('Rajah 1')
  })

  it('returns a warning, not a throw, for text with no questions', () => {
    const p = segmentPaper(request([['Teks tanpa soalan.']]))
    expect(p.questions).toEqual([])
    expect(p.warnings.length).toBeGreaterThan(0)
  })
})

describe('provider selection', () => {
  const cfg = (env: Record<string, string>): AiConfig => new AiConfig(new ConfigService(env))
  const noFetch = (): Promise<Response> => Promise.reject(new Error('no network'))
  const noDns = (): Promise<string[]> => Promise.resolve([])

  it('keeps the prototype mock when OCR is off (tests and dev)', () => {
    const p = createProvider(cfg({}), noFetch, noDns)
    expect(p).toBeInstanceOf(MockProvider)
    expect(p).not.toBeInstanceOf(SegmenterProvider)
    expect(p.model).toBe('heuristik-1')
    expect(createProvider(cfg({ OCR_ENGINE: 'none' }), noFetch, noDns).model).toBe('heuristik-1')
  })

  it('uses the real-paper segmenter when OCR_ENGINE=tesseract', async () => {
    const p = createProvider(cfg({ OCR_ENGINE: 'tesseract' }), noFetch, noDns)
    expect(p).toBeInstanceOf(SegmenterProvider)
    expect(p.model).toBe('segmenter-1')
    const out = await p.extractPaper(request([SAMPLE_PAGE_1, SAMPLE_PAGE_2]), { signal: new AbortController().signal })
    expect(out.paper.questions).toHaveLength(6)
  })
})
