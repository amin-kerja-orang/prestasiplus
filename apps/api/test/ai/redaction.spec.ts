import { describe, expect, it } from 'vitest'

import { redactExtractRequest, redactGenerateTextRequest, redactSuggestTagsRequest } from '../../src/modules/ai-extraction/redaction/redact-request'
import { MASK, Redactor } from '../../src/modules/ai-extraction/redaction/redactor'

/** Fictitious cover page: every detail below is invented. The test strings are the canaries. */
const COVER = `SEKOLAH MENENGAH KEBANGSAAN TAMAN CONTOH
KERTAS PERCUBAAN SPM 2025
Nama: Ahmad bin Ali
Kelas: 5 Cemerlang
No. K/P: 080515-14-1234
Angka Giliran: CANARY-GILIRAN-5521
Tel: 012-345 6789
Emel: ahmad.ali.canary@example.test
Disediakan oleh: Puan Siti Aminah
Guru Besar: Encik Kumar a/l Raju
Alamat: No. 12, Jalan Contoh 3, Taman Contoh, 43000 Kajang
Hubungi pengetua di +60 3-1234 5678 atau 03-9876 5432.
Pelajar Siti binti Hassan dan Lim Wei Ming (SMJK Contoh Jaya) menjawab.
1. Selesaikan persamaan 2x + 6 = 14. [2 markah]`

const CANARIES = [
  'TAMAN CONTOH',
  'Ahmad',
  'bin Ali',
  'Cemerlang',
  '080515-14-1234',
  'CANARY-GILIRAN-5521',
  '012-345 6789',
  'ahmad.ali.canary@example.test',
  'Siti Aminah',
  'Kumar',
  'Raju',
  'Jalan Contoh 3',
  '43000',
  '1234 5678',
  '9876 5432',
  'Siti binti Hassan',
  'SMJK Contoh Jaya',
]

describe('Redactor', () => {
  it('masks names, school, contacts, IC number, address and student identifiers on a cover page', () => {
    const r = new Redactor()
    const out = r.redact(COVER)
    for (const canary of CANARIES) expect(out, canary).not.toContain(canary)
    expect(out).toContain(MASK.person_name)
    expect(out).toContain(MASK.school_name)
    expect(out).toContain(MASK.phone)
    expect(out).toContain(MASK.email)
    expect(out).toContain(MASK.ic_number)
    expect(out).toContain(MASK.address)
    const flags = r.summary().masked.map((m) => m.flag).sort()
    expect(flags).toEqual(['address', 'email', 'ic_number', 'person_name', 'phone', 'school_name'])
    expect(r.summary().applied).toBe(true)
  })

  it('keeps the question content: wording, numbers, marks and figures are untouched', () => {
    const body = [
      '1. Selesaikan persamaan 2x + 6 = 14. [2 markah]',
      'Rajah 1: Segi tiga bersudut tegak ABC dengan AB = 6 cm dan BC = 8 cm.',
      '2. Antara berikut, yang manakah nilai min bagi 2, 4, 6, 8?',
      '3. Hitung 1 000 000 + 2 500 000 dalam bentuk piawai.',
      'A. 4',
      'Skema 3(a)',
      'K1 AC^2 = 6^2 + 8^2 [1]',
      'Seorang pelajar berlari 100 m dalam 20 s. Hitung laju purata.',
    ].join('\n')
    const r = new Redactor()
    expect(r.redact(body)).toBe(body)
    expect(r.summary().masked).toEqual([])
  })

  it('counts without keeping the text, and the masked text appears nowhere in the summary', () => {
    const r = new Redactor()
    r.redact('Emel: a@b.test dan c@d.test')
    const s = JSON.stringify(r.summary())
    expect(s).not.toContain('a@b.test')
    expect(r.summary().masked).toEqual([{ flag: 'email', count: 2 }])
  })

  it('handles IC numbers with spaces and without separators, and mobile numbers with +60', () => {
    const out = new Redactor().redact('IC 080515141234 atau 080515 14 1234; hubungi +6012-3456789 atau 0123456789.')
    expect(out).not.toMatch(/\d{6}/)
    expect(out).not.toContain('3456789')
  })

  it('does not run on across lines when masking a name', () => {
    const out = new Redactor().redact('Encik Ali\nSoalan 1 ialah mudah.')
    expect(out).toBe(`${MASK.person_name}\nSoalan 1 ialah mudah.`)
  })
})

describe('request redaction', () => {
  it('extract: page text, taxonomy labels and structure labels are redacted; images are dropped', () => {
    const { request, summary } = redactExtractRequest({
      pages: [{ page: 1, text: COVER, source: 'text-layer' }],
      images: [{ page: 1, fileId: '4411', width: 100, height: 100 }],
      subject: 'MAT',
      kertas: 2,
      taxonomy: [{ code: 'MAT-T4-09', label: 'Statistik oleh Encik Ali', form: 'T4' }],
      structure: [{ label: 'Bahagian A (Puan Siti Aminah)', type: 'mcq' }],
    })
    const wire = JSON.stringify(request)
    for (const canary of [...CANARIES, 'Encik Ali']) expect(wire, canary).not.toContain(canary)
    expect(request.images).toBeUndefined()
    expect(wire).not.toContain('4411')
    expect(summary.masked.length).toBeGreaterThan(0)
  })

  it('suggestTags: stems are redacted and the caller keys are replaced by positional keys', () => {
    const r = redactSuggestTagsRequest({
      subject: 'MAT',
      items: [
        { ref: 'question-98765', stem: 'Soalan oleh Puan Siti Aminah: min bagi 2, 4.' },
        { ref: 'question-98766', stem: 'Nilai x? Hubungi 012-345 6789', type: 'short' },
      ],
      taxonomy: [{ code: 'MAT-T4-09', label: 'Statistik' }],
    })
    const wire = JSON.stringify(r.request)
    expect(wire).not.toContain('98765')
    expect(wire).not.toContain('Siti Aminah')
    expect(wire).not.toContain('345 6789')
    expect(r.request.items.map((i) => i.ref)).toEqual(['q1', 'q2'])
    expect(r.refs).toEqual(['question-98765', 'question-98766'])
  })

  it('generateText: both the system text and the input are redacted', () => {
    const { request, summary } = redactGenerateTextRequest({
      purpose: 'cikgu.chat',
      system: 'Anda membantu murid Ahmad bin Ali dari SMK Contoh Jaya.',
      input: 'Emel saya ahmad@example.test, IC 080515-14-1234. Apakah teorem Pythagoras?',
    })
    const wire = JSON.stringify(request)
    for (const canary of ['Ahmad bin Ali', 'SMK Contoh Jaya', 'ahmad@example.test', '080515-14-1234']) expect(wire, canary).not.toContain(canary)
    expect(wire).toContain('Apakah teorem Pythagoras?')
    expect(request.purpose).toBe('cikgu.chat')
    expect(summary.masked.length).toBeGreaterThan(0)
  })
})
