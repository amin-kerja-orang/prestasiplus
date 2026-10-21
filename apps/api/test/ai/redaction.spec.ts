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

describe('redaction survives look-alike text (hardening)', () => {
  const run = (text: string) => {
    const r = new Redactor()
    const out = r.redact(text)
    return { out, flags: r.summary().masked.map((m) => m.flag) }
  }

  it.each([
    ['full-width IC', 'No. KP ９００１０１－１４－５６７８', '900101'],
    ['IC with NBSP separators', 'IC: 900101 14 5678', '900101'],
    ['IC with dot separators', 'Kad 900101.14.5678 tamat', '900101'],
    ['IC with en dash separators', 'Kad 900101–14–5678 tamat', '900101'],
    ['IC with em dash separators', 'Kad 900101—14—5678 tamat', '900101'],
  ])('%s', (_n, text, secret) => {
    const { out, flags } = run(text)
    expect(out).not.toContain(secret)
    expect(out).not.toContain('5678')
    expect(flags).toContain('ic_number')
  })

  it('phone numbers with bidi marks, dots, dashes and NBSP', () => {
    for (const text of ['Hubungi ‪012-345 6789‬ segera', 'Hubungi 012.345.6789 segera', 'Hubungi 012 345 6789 segera', 'Hubungi +60‏12–345–6789 segera']) {
      const { out, flags } = run(text)
      expect(out, text).not.toMatch(/345/)
      expect(flags, text).toContain('phone')
    }
  })

  it('e-mail with a zero-width space before @, a full-width @, [at], (at), spaced and [dot] variants', () => {
    for (const text of [
      'cikgu.contoh​@example.test',
      'cikgu.contoh＠example.test',
      'cikgu.contoh [at] example.test',
      'cikgu.contoh(at)example.test',
      'cikgu.contoh @ example.test',
      'cikgu.contoh [at] example [dot] test',
    ]) {
      const { out, flags } = run(`Emel pengawas: ${text} sekian`)
      expect(out, text).not.toMatch(/contoh|example/)
      expect(flags, text).toContain('email')
    }
  })

  it('full-width labels, bullets, indentation, a missing colon and a value on the next line', () => {
    const cases: [string, string][] = [
      ['ＮＡＭＡ: Zulkifli bin Contoh', 'Zulkifli'],
      ['  - Nama: Zulkifli bin Contoh', 'Zulkifli'],
      ['\t• Nama : Zulkifli bin Contoh', 'Zulkifli'],
      ['Nama :\nZulkifli bin Contoh', 'Zulkifli'],
      ['Nama:\n   Zulkifli bin Contoh', 'Zulkifli'],
      ['Nama Zulkifli bin Contoh', 'Zulkifli'],
      ['  * No. KP 900101145678', '900101'],
      ['Sekolah:\nSekolah Contoh Maju', 'Contoh'],
      ['- Kelas: 5 Cemerlang', 'Cemerlang'],
      ['  - Tel: 012 345 6789', '345'],
      ['• E-mel: pengawas.contoh@example.test', 'example'],
    ]
    for (const [text, secret] of cases) {
      const { out, flags } = run(`${text}\n1. Selesaikan 2x + 6 = 14.`)
      expect(out, text).not.toContain(secret)
      expect(flags.length, text).toBeGreaterThan(0)
      expect(out, text).toContain('2x + 6 = 14')
    }
  })

  it('does not eat ordinary question lines (words that are labels only with a colon)', () => {
    for (const line of ['Murid A mempunyai 5 buah buku.', 'Name the largest planet.', 'Kelas itu mempunyai 30 orang.', 'Emel saya ahmad.contoh@example.test dan nilai x = 3']) {
      const { out } = run(line)
      expect(out.startsWith(line.slice(0, 5))).toBe(true)
    }
    expect(run('Name the largest planet.').out).toBe('Name the largest planet.')
    expect(run('Murid A mempunyai 5 buah buku.').out).toBe('Murid A mempunyai 5 buah buku.')
  })

  it('keeps mathematics intact: superscripts, subscripts and fractions are not rewritten by NFKC', () => {
    const { out } = run('Nilai x² + y³ = ½ dan H₂O; 3 × 4 ≤ 12')
    expect(out).toBe('Nilai x² + y³ = ½ dan H₂O; 3 × 4 ≤ 12')
  })
})
