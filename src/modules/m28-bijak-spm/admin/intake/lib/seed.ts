/** The demo intake batch shown on a fresh install: parsed from the fictional sample paper. */
import { triangleSvg } from '../../../data/diagrams'
import { parsePaper } from '../ai/mock-extractor'
import type { IntakeBatch } from '../types'
import { SAMPLE_PAGES } from './sample-paper'

export const DEMO_BATCH_ID = 'ek-demo-1'

export function demoBatch(now: number, userId = 1): IntakeBatch {
  const out = parsePaper({ pages: SAMPLE_PAGES, subject: 'MAT', kertas: 2 })
  const stimuli = out.stimuli.map((s) =>
    s.id && s.kind === 'diagram'
      ? {
          ...s,
          alt: 'Segi tiga bersudut tegak ABC, AB = 6 cm, BC = 8 cm.',
          svg: triangleSvg(6, 8, 'Segi tiga bersudut tegak ABC, AB = 6 cm, BC = 8 cm.'),
        }
      : s,
  )
  return {
    id: DEMO_BATCH_ID,
    userId,
    subject: 'MAT',
    kertas: 2,
    year: 2025,
    paperType: 'Percubaan SPM',
    source: 'Kertas contoh fiksyen untuk demo',
    copyright: 'sendiri',
    notes: '',
    fileName: 'kertas-contoh-mat-k2.pdf',
    fileHash: 'demo-seed',
    pageCount: SAMPLE_PAGES.length,
    status: 'draf',
    createdAt: now,
    updatedAt: now,
    provider: out.provider,
    model: out.model,
    questions: out.questions,
    stimuli,
    unmatched: out.unmatched,
    pages: SAMPLE_PAGES,
  }
}
