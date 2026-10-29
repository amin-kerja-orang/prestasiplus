import { describe, expect, it } from 'vitest'

import { envelopeOf } from '../../../common/envelope'
import { ErrorBodySchema } from '../../../common/error'
import { buildOpenApiDocument } from '../../../openapi'
import { BIJAK_PAPERS_COMPONENT_SCHEMAS } from '../paths'
import {
  BIJAK_PAPERS_MESSAGES,
  BijakBlueprintContractSchema,
  BijakGenerateNoBlueprintErrorSchema,
  BijakGenerateRequestSchema,
  BijakGenerateResultSchema,
  BijakGenerateShortageErrorSchema,
  BijakPaperCoverSchema,
  BijakPaperSummarySchema,
  BijakSubjectSchema,
} from '../schema'
import { z } from '../../../zod'

/* Payloads are taken from the m28 mock (BijakServer.listPapers / getCover / listContracts /
 * subjects / generatePaper over the seed registry); only fictitious practice content. */

const summaryMatK1 = {
  id: 'mat-k1-2025-a',
  title: 'Percubaan SPM Matematik Kertas 1 Set A',
  subject: 'MAT',
  subjectName: 'Matematik',
  kertas: 1,
  year: 2025,
  code: '1449/1',
  durationMin: 75,
  questionCount: 10,
  marks: 10,
  kind: 'pilihan',
  status: 'belum',
}
const summaryMatK2 = {
  ...summaryMatK1,
  id: 'mat-k2-2025-a',
  title: 'Percubaan SPM Matematik Kertas 2 Set A',
  kertas: 2,
  code: '1449/2',
  durationMin: 150,
  questionCount: 6,
  marks: 21,
}
const summarySnK2 = {
  ...summaryMatK1,
  id: 'sn-k2-2025-a',
  title: 'Percubaan SPM Sains Kertas 2 (Contoh Pendek)',
  subject: 'SN',
  subjectName: 'Sains',
  kertas: 2,
  code: '4541/2',
  durationMin: 60,
  questionCount: 5,
  marks: 13,
}
const summarySejK2 = {
  ...summaryMatK1,
  id: 'sej-k2-2025-a',
  title: 'Percubaan SPM Sejarah Kertas 2 (Contoh Pendek)',
  subject: 'SEJ',
  subjectName: 'Sejarah',
  kertas: 2,
  code: '1249/2',
  durationMin: 90,
  questionCount: 4,
  marks: 19,
}
const reference = [
  {
    title: 'Rumus (ringkas)',
    items: [
      'Teorem Pythagoras: $c^2 = a^2 + b^2$',
      'Kecerunan: $m = \\frac{y_2 - y_1}{x_2 - x_1}$',
      'Luas segi tiga: $\\frac{1}{2} \\times \\text{tapak} \\times \\text{tinggi}$',
      'Luas bulatan: $\\pi j^2$, $\\pi = \\frac{22}{7}$',
      'Min: $\\frac{\\text{jumlah nilai}}{\\text{bilangan nilai}}$',
    ],
  },
]
const coverMatK2 = {
  ...summaryMatK2,
  instructions: [
    'Kertas ini mengandungi tiga bahagian: Bahagian A, Bahagian B dan Bahagian C.',
    'Jawab semua soalan dalam Bahagian A dan Bahagian B, dan satu soalan dalam Bahagian C.',
    'Tunjukkan langkah kerja anda. Markah boleh diberi untuk kaedah yang betul.',
  ],
  reference,
  sections: [
    {
      label: 'Bahagian A',
      marks: 9,
      instruction: 'Jawab semua soalan.',
      questionCount: 3,
      compulsory: false,
    },
    {
      label: 'Bahagian B',
      marks: 6,
      instruction: 'Jawab semua soalan.',
      questionCount: 1,
      compulsory: false,
    },
    {
      label: 'Bahagian C',
      marks: 6,
      instruction: 'Jawab 1 daripada 2 soalan.',
      questionCount: 2,
      compulsory: false,
      chooseN: 1,
    },
  ],
}
const coverSnK2 = {
  ...summarySnK2,
  instructions: [
    'Kertas ini mengandungi dua bahagian: Bahagian A dan Bahagian B.',
    'Jawab semua soalan dalam Bahagian A dan satu soalan dalam Bahagian B.',
  ],
  reference: [],
  sections: [
    {
      label: 'Bahagian A',
      marks: 9,
      instruction: 'Jawab semua soalan.',
      questionCount: 3,
      compulsory: false,
    },
    {
      label: 'Bahagian B',
      marks: 4,
      instruction: 'Jawab 1 daripada 2 soalan.',
      questionCount: 2,
      compulsory: false,
      chooseN: 1,
    },
  ],
}
const coverGenerated = {
  ...coverMatK2,
  id: 'jana-mat-k2-1',
  title: 'Kertas Jana Matematik Kertas 2 (#1)',
  year: 2027,
  marks: 22,
  kind: 'jana',
}
const contracts = [
  {
    subject: 'MAT',
    subjectName: 'Matematik',
    kertas: 1,
    source: 'Spec',
    code: '1449/1',
    durationMin: 75,
    sections: [{ label: 'Objektif', take: 10 }],
    canGenerate: true,
  },
  {
    subject: 'MAT',
    subjectName: 'Matematik',
    kertas: 2,
    source: 'Spec',
    code: '1449/2',
    durationMin: 150,
    sections: [
      { label: 'Bahagian A', take: 3 },
      { label: 'Bahagian B', take: 1 },
      { label: 'Bahagian C', take: 2 },
    ],
    canGenerate: false,
    unavailableReason: 'NO_BLUEPRINT',
  },
  {
    subject: 'SN',
    subjectName: 'Sains',
    kertas: 1,
    source: 'Spec',
    code: '4541/1',
    durationMin: 60,
    sections: [{ label: 'Bahagian A', take: 40 }],
    canGenerate: true,
  },
]
const subjects = [
  { code: 'MAT', name: 'Matematik' },
  { code: 'SN', name: 'Sains' },
  { code: 'SEJ', name: 'Sejarah' },
]

/** Keys that must never appear anywhere in a response of this card (BE-15 AC 6, US-15). */
const FORBIDDEN_KEYS = [
  'correct',
  'correctOption',
  'correctLetter',
  'answer',
  'answers',
  'accept',
  'accepted',
  'acceptedText',
  'scheme',
  'markScheme',
  'key',
  'points',
  'explanation',
  'reason',
  'finalDisplay',
  'model',
  'rubric',
  'questionIds',
  'pool',
]
function keysOf(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => keysOf(v, out))
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) {
      out.add(k)
      keysOf(v, out)
    }
  return out
}

describe('BijakPaperSummary (listPapers)', () => {
  const List = envelopeOf(z.array(BijakPaperSummarySchema))

  it('parses the four seeded papers', () => {
    const body = { data: [summaryMatK1, summaryMatK2, summarySnK2, summarySejK2] }
    expect(List.safeParse(body).success).toBe(true)
  })

  it('parses an in-progress paper with attemptId and a finished one with lastScore', () => {
    expect(
      BijakPaperSummarySchema.safeParse({ ...summaryMatK1, status: 'sedang', attemptId: 'pcb-1-7' })
        .success,
    ).toBe(true)
    expect(
      BijakPaperSummarySchema.safeParse({
        ...summaryMatK1,
        status: 'selesai',
        lastScore: { score: 7, max: 10 },
      }).success,
    ).toBe(true)
    // the mock reports sedang together with the lastScore of an earlier submitted attempt
    expect(
      BijakPaperSummarySchema.safeParse({
        ...summaryMatK1,
        status: 'sedang',
        attemptId: 'pcb-2-7',
        lastScore: { score: 0, max: 10 },
      }).success,
    ).toBe(true)
  })

  it('rejects numeric ids, an unknown kind or status, and a missing field', () => {
    expect(BijakPaperSummarySchema.safeParse({ ...summaryMatK1, id: 12 }).success).toBe(false)
    expect(BijakPaperSummarySchema.safeParse({ ...summaryMatK1, attemptId: 9 }).success).toBe(false)
    expect(BijakPaperSummarySchema.safeParse({ ...summaryMatK1, kind: 'rasmi' }).success).toBe(
      false,
    )
    expect(BijakPaperSummarySchema.safeParse({ ...summaryMatK1, status: 'done' }).success).toBe(
      false,
    )
    expect(BijakPaperSummarySchema.safeParse({ ...summaryMatK1, durationMin: 0 }).success).toBe(
      false,
    )
    expect(BijakPaperSummarySchema.safeParse({ ...summaryMatK1, kertas: '1' }).success).toBe(false)
    const { code: _code, ...noCode } = summaryMatK1
    void _code
    expect(BijakPaperSummarySchema.safeParse(noCode).success).toBe(false)
  })

  it('rejects an answer key or scheme riding on a list row', () => {
    expect(
      BijakPaperSummarySchema.safeParse({
        ...summaryMatK1,
        scheme: { kind: 'option', correct: 'B' },
      }).success,
    ).toBe(false)
    expect(
      BijakPaperSummarySchema.safeParse({ ...summaryMatK1, questionIds: ['q1'] }).success,
    ).toBe(false)
  })
})

describe('BijakPaperCover (getCover)', () => {
  const Cover = envelopeOf(BijakPaperCoverSchema)

  it('parses the seeded covers, a paper without reference sheet, and a generated paper', () => {
    expect(Cover.safeParse({ data: coverMatK2 }).success).toBe(true)
    expect(Cover.safeParse({ data: coverSnK2 }).success).toBe(true)
    expect(Cover.safeParse({ data: coverGenerated }).success).toBe(true)
  })

  it('keeps choose-N sections: chooseN only on a choose section, instruction always present', () => {
    const parsed = BijakPaperCoverSchema.parse(coverMatK2)
    expect(parsed.sections.map((s) => s.chooseN)).toEqual([undefined, undefined, 1])
    expect(parsed.sections.every((s) => s.instruction.length > 0)).toBe(true)
    expect(
      BijakPaperCoverSchema.safeParse({
        ...coverMatK2,
        sections: [{ ...coverMatK2.sections[0], instruction: '' }],
      }).success,
    ).toBe(false)
    expect(
      BijakPaperCoverSchema.safeParse({
        ...coverMatK2,
        sections: [{ ...coverMatK2.sections[2], chooseN: 0 }],
      }).success,
    ).toBe(false)
  })

  it('rejects a cover without sections, or with a non-array instructions', () => {
    expect(BijakPaperCoverSchema.safeParse({ ...coverMatK2, sections: [] }).success).toBe(false)
    expect(
      BijakPaperCoverSchema.safeParse({ ...coverMatK2, instructions: 'Jawab semua soalan.' })
        .success,
    ).toBe(false)
    expect(
      BijakPaperCoverSchema.safeParse({
        ...coverMatK2,
        reference: [{ title: 'Rumus', items: [3] }],
      }).success,
    ).toBe(false)
  })

  it('rejects a cover that leaks a mark scheme or an answer key', () => {
    const leakyTop = { ...coverMatK2, scheme: { kind: 'points', marks: 3, points: [] } }
    expect(BijakPaperCoverSchema.safeParse(leakyTop).success).toBe(false)
    expect(BijakPaperCoverSchema.safeParse({ ...coverMatK2, answers: { q1: 'B' } }).success).toBe(
      false,
    )
    const leakySection = {
      ...coverMatK2,
      sections: coverMatK2.sections.map((s) => ({ ...s, correct: 'B' })),
    }
    expect(BijakPaperCoverSchema.safeParse(leakySection).success).toBe(false)
    const leakyIds = {
      ...coverMatK2,
      sections: coverMatK2.sections.map((s) => ({ ...s, questionIds: ['q1'] })),
    }
    expect(BijakPaperCoverSchema.safeParse(leakyIds).success).toBe(false)
    const leakyPanel = {
      ...coverMatK2,
      reference: [{ ...reference[0], explanation: 'Kerana ...' }],
    }
    expect(BijakPaperCoverSchema.safeParse(leakyPanel).success).toBe(false)
  })

  it('carries no forbidden key in any valid payload of this card (recursive key scan)', () => {
    const everything = [
      { data: [summaryMatK1, summaryMatK2, summarySnK2, summarySejK2] },
      { data: coverMatK2 },
      { data: coverSnK2 },
      { data: coverGenerated },
      { data: contracts },
      { data: subjects },
      { data: { paperId: 'jana-mat-k2-1' } },
    ]
    const keys = keysOf(everything)
    for (const bad of FORBIDDEN_KEYS) expect(keys.has(bad), bad).toBe(false)
  })

  it('has default instruction copy that matches the mock', () => {
    const instructions = coverMatK2.sections.map((s) => s.instruction)
    expect(instructions).toEqual([
      'Jawab semua soalan.',
      'Jawab semua soalan.',
      'Jawab 1 daripada 2 soalan.',
    ])
  })

  it('carries the 404 body "Kertas tidak ditemui"', () => {
    const body = { error: { code: 'NOT_FOUND', message: BIJAK_PAPERS_MESSAGES.paperNotFound } }
    expect(ErrorBodySchema.safeParse(body).success).toBe(true)
    expect(BIJAK_PAPERS_MESSAGES.paperNotFound).toBe('Kertas tidak ditemui')
  })
})

describe('BijakBlueprintContract (listContracts) and BijakSubject (subjects)', () => {
  it('parses the seeded contracts, including a long section', () => {
    expect(
      envelopeOf(z.array(BijakBlueprintContractSchema)).safeParse({ data: contracts }).success,
    ).toBe(true)
  })

  it('accepts the three provenance tags and rejects any other', () => {
    for (const source of ['Disahkan', 'Spec', 'Draf'])
      expect(BijakBlueprintContractSchema.safeParse({ ...contracts[0], source }).success).toBe(true)
    expect(
      BijakBlueprintContractSchema.safeParse({ ...contracts[0], source: 'derived' }).success,
    ).toBe(false)
  })

  it('rejects an internal pool tag, a missing section list and an empty one', () => {
    const withPool = {
      ...contracts[0],
      sections: [{ label: 'Objektif', take: 10, pool: 'MAT1-A' }],
    }
    expect(BijakBlueprintContractSchema.safeParse(withPool).success).toBe(false)
    expect(BijakBlueprintContractSchema.safeParse({ ...contracts[0], sections: [] }).success).toBe(
      false,
    )
    expect(
      BijakBlueprintContractSchema.safeParse({
        ...contracts[0],
        sections: [{ label: 'A', take: -1 }],
      }).success,
    ).toBe(false)
    expect(
      BijakBlueprintContractSchema.safeParse({ ...contracts[0], durationMin: 1.5 }).success,
    ).toBe(false)
  })

  it('parses the subject dictionary and keeps the code a string', () => {
    expect(envelopeOf(z.array(BijakSubjectSchema)).safeParse({ data: subjects }).success).toBe(true)
    expect(BijakSubjectSchema.safeParse({ code: 1, name: 'Matematik' }).success).toBe(false)
    expect(BijakSubjectSchema.safeParse({ code: '', name: 'Matematik' }).success).toBe(false)
    expect(BijakSubjectSchema.safeParse({ code: 'MAT' }).success).toBe(false)
  })
})

describe('generate (Jana Kertas)', () => {
  it('accepts a subject and an integer kertas, and rejects bad input', () => {
    expect(BijakGenerateRequestSchema.safeParse({ subject: 'MAT', kertas: 2 }).success).toBe(true)
    expect(BijakGenerateRequestSchema.safeParse({ subject: 'MAT', kertas: '2' }).success).toBe(
      false,
    )
    expect(BijakGenerateRequestSchema.safeParse({ subject: 'MAT', kertas: 1.5 }).success).toBe(
      false,
    )
    expect(BijakGenerateRequestSchema.safeParse({ subject: 'MAT', kertas: 0 }).success).toBe(false)
    expect(BijakGenerateRequestSchema.safeParse({ subject: '', kertas: 1 }).success).toBe(false)
    expect(BijakGenerateRequestSchema.safeParse({ kertas: 1 }).success).toBe(false)
  })

  it('parses the 201 result: a string paper id and nothing else', () => {
    expect(
      envelopeOf(BijakGenerateResultSchema).safeParse({ data: { paperId: 'jana-mat-k2-1' } })
        .success,
    ).toBe(true)
    expect(BijakGenerateResultSchema.safeParse({ paperId: 7 }).success).toBe(false)
    expect(
      BijakGenerateResultSchema.safeParse({ paperId: 'jana-mat-k2-1', sections: [] }).success,
    ).toBe(false)
  })

  it('parses the 422 NO_BLUEPRINT body with the mock copy', () => {
    const body = {
      error: { code: 'NO_BLUEPRINT', message: 'Belum ada kontrak untuk subjek dan kertas ini' },
    }
    expect(BijakGenerateNoBlueprintErrorSchema.safeParse(body).success).toBe(true)
    expect(ErrorBodySchema.safeParse(body).success).toBe(true)
    expect(
      BijakGenerateNoBlueprintErrorSchema.safeParse({ error: { ...body.error, code: 'SHORTAGE' } })
        .success,
    ).toBe(false)
  })

  it('parses the 422 SHORTAGE body with the shortage list (mock: SN kertas 1 needs 40, has 0)', () => {
    const body = {
      error: {
        code: 'SHORTAGE',
        message: 'Kertas tidak dapat dijana kerana soalan tidak mencukupi.',
        details: { shortages: [{ section: 'Bahagian A', need: 40, have: 0 }] },
      },
    }
    expect(BijakGenerateShortageErrorSchema.safeParse(body).success).toBe(true)
    expect(ErrorBodySchema.safeParse(body).success).toBe(true)
  })

  it('rejects a SHORTAGE body without shortages or with a malformed one', () => {
    const base = { code: 'SHORTAGE', message: BIJAK_PAPERS_MESSAGES.shortage }
    expect(BijakGenerateShortageErrorSchema.safeParse({ error: base }).success).toBe(false)
    expect(
      BijakGenerateShortageErrorSchema.safeParse({ error: { ...base, details: { shortages: [] } } })
        .success,
    ).toBe(false)
    expect(
      BijakGenerateShortageErrorSchema.safeParse({
        error: { ...base, details: { shortages: [{ section: 'A', need: 3 }] } },
      }).success,
    ).toBe(false)
    expect(
      BijakGenerateShortageErrorSchema.safeParse({
        error: { ...base, details: { shortages: [{ section: 'A', need: 3, have: -1 }] } },
      }).success,
    ).toBe(false)
  })
})

describe('openapi document', () => {
  const doc = buildOpenApiDocument() as {
    paths: Record<
      string,
      Record<
        string,
        {
          tags?: string[]
          responses: Record<string, unknown>
          parameters?: { name: string; in: string }[]
        }
      >
    >
    components: { schemas: Record<string, unknown> }
  }

  it('contains the five routes with the documented status codes', () => {
    const ops = (path: string, method: string) => {
      const op = doc.paths[path]?.[method]
      expect(op, `${method} ${path}`).toBeDefined()
      return op!
    }
    expect(Object.keys(ops('/bijak/papers', 'get').responses).sort()).toEqual(['200', '401', '403'])
    expect(Object.keys(ops('/bijak/papers/{id}', 'get').responses).sort()).toEqual([
      '200',
      '401',
      '403',
      '404',
    ])
    expect(Object.keys(ops('/bijak/contracts', 'get').responses).sort()).toEqual([
      '200',
      '401',
      '403',
    ])
    expect(Object.keys(ops('/bijak/subjects', 'get').responses).sort()).toEqual([
      '200',
      '401',
      '403',
    ])
    const generate = ops('/bijak/papers/generate', 'post')
    expect(Object.keys(generate.responses).sort()).toEqual(['201', '401', '403', '422', '503'])
    expect(generate.parameters?.some((p) => p.name === 'X-CSRF-Token' && p.in === 'header')).toBe(
      true,
    )
  })

  it('has exactly five operations with the bijak-papers tag and no CSRF header on the GETs', () => {
    const tagged = Object.entries(doc.paths).flatMap(([path, methods]) =>
      Object.entries(methods)
        .filter(([, op]) => op.tags?.includes('bijak-papers'))
        .map(([method]) => `${method} ${path}`),
    )
    expect(tagged.sort()).toEqual([
      'get /bijak/contracts',
      'get /bijak/papers',
      'get /bijak/papers/{id}',
      'get /bijak/subjects',
      'post /bijak/papers/generate',
    ])
    for (const [path, method] of [
      ['/bijak/papers', 'get'],
      ['/bijak/papers/{id}', 'get'],
      ['/bijak/contracts', 'get'],
      ['/bijak/subjects', 'get'],
    ] as const) {
      const params = doc.paths[path]![method]!.parameters ?? []
      expect(
        params.some((p) => p.name === 'X-CSRF-Token'),
        path,
      ).toBe(false)
    }
  })

  it('contains every component of this card, all prefixed Bijak', () => {
    const names = Object.keys(BIJAK_PAPERS_COMPONENT_SCHEMAS)
    expect(names).toHaveLength(15)
    for (const name of names) {
      expect(name.startsWith('Bijak'), name).toBe(true)
      expect(doc.components.schemas[name], name).toBeDefined()
    }
  })

  it('has unique component ids and no bare generic names', () => {
    const names = Object.keys(doc.components.schemas)
    expect(new Set(names).size).toBe(names.length)
    for (const bare of ['Paper', 'Subject', 'Section', 'Contract', 'Blueprint'])
      expect(names).not.toContain(bare)
  })

  it('does not expose a mark scheme, answer key or question list in the response components', () => {
    const json = JSON.stringify(
      [
        'BijakPaperSummary',
        'BijakPaperCover',
        'BijakPaperCoverSection',
        'BijakBlueprintContract',
        'BijakBlueprintSection',
        'BijakSubject',
      ].map((n) => doc.components.schemas[n]),
    )
    for (const bad of [
      '"scheme"',
      '"correct"',
      '"accept"',
      '"questionIds"',
      '"explanation"',
      '"pool"',
    ])
      expect(json).not.toContain(bad)
  })
})
