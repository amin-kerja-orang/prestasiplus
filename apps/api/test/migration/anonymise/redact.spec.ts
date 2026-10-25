/**
 * The `redact-pii` rule (A1-LEAK, route 4): unit tests. Every value below is FAKE: reserved or `.invalid` domains, patterned
 * numbers (1111, 0101), made-up names. No real person or number is used.
 */
import { describe, expect, it } from 'vitest'

import { LeakScanner, OriginalsIndex, patternKinds, type PiiSpan } from '../../../src/migration/anonymise/leak-scan'
import { PiiRedactor, REDACTED_TOKEN, type RedactKind } from '../../../src/migration/anonymise/redact'
import { Pseudonymiser } from '../../../src/migration/anonymise/pseudonyms'
import { applyRule, parseConfig, type Rule } from '../../../src/migration/anonymise/rules'
import { piiKindsOf } from '../../../src/migration/transform/question-bank'
import { PII, TEST_KEY } from './helpers'

const T = REDACTED_TOKEN
const pseudo = new Pseudonymiser(Buffer.from(TEST_KEY, 'utf8'))
const NAME: Rule = { rule: 'pseudonym', kind: 'name' }

/** An index filled the way the run fills it: values go through a rule and are recorded. */
function indexOf(entries: [Rule, unknown][]): OriginalsIndex {
  const index = new OriginalsIndex()
  for (const [rule, value] of entries) index.record(rule, value, applyRule(rule, value, pseudo))
  return index
}

const FOREIGN = '+44 20 7946 0958' // a fake, not a Malaysian shape: only the index can know it
const index = indexOf([
  [NAME, PII.name1], // Qwertyus Plorbinski
  [NAME, 'Zoë Fiktif Contoh'], // accent, three words
  [NAME, 'ΟΔΟΣ ΦΙΚΤΙΒΟΣ'], // final sigma
  [NAME, 'Contoh Biasa Fiktif'], // made of common words
  [{ rule: 'pseudonym', kind: 'username' }, PII.username1], // qplorbinski_7
  [{ rule: 'pseudonym', kind: 'phone' }, FOREIGN],
  [{ rule: 'pseudonym', kind: 'ic' }, '880808-08-8888'], // month 08 is valid, so also a pattern
])
const redactor = new PiiRedactor(index)
const redact = (v: unknown) => redactor.redact(v)

/** The scan on one cell, with the same index and patterns the run uses. */
const scanHits = (value: unknown): string[] => {
  const scanner = new LeakScanner(index)
  scanner.scanRow('t', { c: value })
  return scanner.result().hits.map((h) => h.kind)
}

describe('redact-pii: text', () => {
  it('replaces only the matching span and keeps the text around it', () => {
    expect(redact('Hubungi 012-345 6789 selepas waktu sekolah.')).toBe(`Hubungi ${T} selepas waktu sekolah.`)
    expect(redact('Dua nombor: 012-345 6789 dan 013-222 3333.')).toBe(`Dua nombor: ${T} dan ${T}.`)
  })

  it.each([
    ['mobile', 'Telefon 012-345 6789 ibu', 'phone'],
    ['mobile with the country code', 'Telefon +60123456789 ibu', 'phone'],
    ['landline', 'Pejabat 03-1234 5678 buka', 'phone'],
    ['landline with the country code', 'Pejabat +6038765 4321 buka', 'phone'],
    ['e-mail', 'Mel ke contoh.fiktif@leak-check.invalid sekarang', 'email'],
    ['IC with dashes', 'IC 900101-14-5555 ialah', 'ic'],
    ['IC without dashes', 'IC 900101145555 ialah', 'ic'],
  ])('%s: the span is masked, the words around it stay, and the scan on the output is clean', (_label, text, kind) => {
    expect(patternKinds(text), 'the scan flags the input').toContain(kind)
    const counted: RedactKind[] = []
    const out = redactor.redact(text, (k) => counted.push(k)) as string
    expect(out).toContain(T)
    expect(out.startsWith(text.split(' ')[0] as string)).toBe(true)
    expect(out.endsWith(text.split(' ').at(-1) as string)).toBe(true)
    expect(counted).toEqual([kind])
    expect(patternKinds(out)).toEqual([])
    expect(scanHits(out)).toEqual([])
  })

  it('keeps an e-mail on the allowed fake domain, like the scan', () => {
    expect(redact('Mel ke anon-abcdefgh@example.test sahaja')).toBe('Mel ke anon-abcdefgh@example.test sahaja')
    const wider = new PiiRedactor(null, { allowedEmailDomains: ['example.test', 'lab.test'] })
    expect(wider.redact('a@lab.test dan b@leak-check.invalid')).toBe(`a@lab.test dan ${T}`)
  })

  it('an indexed whole value is masked when it is the whole cell, with case and spacing ignored (the scan rule)', () => {
    expect(patternKinds(PII.username1)).toEqual([])
    expect(scanHits(PII.username1)).toEqual(['original-value'])
    expect(redact(PII.username1)).toBe(T)
    expect(redact(`  ${PII.username1.toUpperCase()} `)).toBe(T)
    expect(scanHits(redact(PII.username1))).toEqual([])
    // inside longer text it is not flagged by the scan, so it is kept
    expect(redact(`akaun ${PII.username1} aktif`)).toBe(`akaun ${PII.username1} aktif`)
  })

  it('an indexed phone number is masked by its digits, whatever the grouping', () => {
    const text = `Hubungi +44 20 7946 0958 atau +44-20-7946-0958 segera`
    expect(patternKinds(text), 'not a Malaysian shape: no pattern sees it').toEqual([])
    expect(scanHits(text)).toEqual(['original-value'])
    const out = redact(text) as string
    expect(out).toBe(`Hubungi +${T} atau +${T} segera`)
    expect(scanHits(out)).toEqual([])
    // digits split by letters: the scan adds up the digits of the cell; the redactor masks from the first digit to the last
    const split = 'Kod 4420 abc 79460958 tamat'
    expect(scanHits(split)).toEqual(['original-value'])
    const outSplit = redact(split) as string
    expect(outSplit).toBe(`Kod ${T} tamat`)
    expect(scanHits(outSplit)).toEqual([])
  })

  it('an indexed multi-word name inside longer text is masked, whatever the case, spacing and accent form', () => {
    expect(redact(`Penulis ${PII.name1} menang.`)).toBe(`Penulis ${T} menang.`)
    expect(redact('Penulis QWERTYUS   plorbinski, menang.')).toBe(`Penulis ${T}, menang.`)
    expect(redact('Tanya Zoë Fiktif Contoh hari ini')).toBe(`Tanya ${T} hari ini`)
    // the same name with a decomposed e + combining diaeresis (NFKC folds it, as the scan does)
    const decomposed = 'Tanya Zoë Fiktif Contoh hari ini'
    expect(scanHits(decomposed)).toEqual(['original-name'])
    expect(redact(decomposed)).toBe(`Tanya ${T} hari ini`)
    // a final sigma is lower-cased by context
    const greek = 'Lihat ΟΔΟΣ ΦΙΚΤΙΒΟΣ di sini'
    expect(scanHits(greek)).toEqual(['original-name'])
    expect(redact(greek)).toBe(`Lihat ${T} di sini`)
    for (const text of [`Penulis ${PII.name1} menang.`, decomposed, greek]) expect(scanHits(redact(text))).toEqual([])
  })

  it('never masks a single word of a name, nor a common word, on its own', () => {
    for (const text of ['Qwertyus', 'Plorbinski', 'Penulis Plorbinski menang', 'Qwertyus dan Plorbinski', 'Fiktif', 'Contoh biasa', 'contoh yang biasa fiktif', 'biasa', 'Contoh']) {
      expect(scanHits(text), text).toEqual([])
      expect(redact(text), text).toBe(text)
    }
    // the exact run of words is the name, so it is masked
    expect(redact('lihat contoh biasa fiktif sahaja')).toBe(`lihat ${T} sahaja`)
  })

  it('masks the digits of a maths string that has the shape of a number (a false positive, by design)', () => {
    expect(redact('Hitung 0123456789 + 1')).toBe(`Hitung ${T} + 1`)
    expect(redact('Cari 03-1234 5678 pada garis')).toBe(`Cari ${T} pada garis`)
    expect(redact('Hitung 1234567 + 89 dan 3.14159 serta 2024-10-24')).toBe('Hitung 1234567 + 89 dan 3.14159 serta 2024-10-24')
  })

  it('keeps HTML around the masked span', () => {
    expect(redact('<p>Hubungi 012-345 6789</p>')).toBe(`<p>Hubungi ${T}</p>`)
    expect(redact('<div class="a"><b>Mel</b>: <a href="x">a.b@leak-check.invalid</a></div>')).toBe(`<div class="a"><b>Mel</b>: <a href="x">${T}</a></div>`)
    expect(redact('<p>Ini 2 + 3 = 5</p>')).toBe('<p>Ini 2 + 3 = 5</p>')
  })

  it('NULL and "" stay as they are; values that are not text are unchanged', () => {
    expect(redact(null)).toBeNull()
    expect(redact(undefined)).toBeNull()
    expect(redact('')).toBe('')
    expect(redact(0)).toBe(0)
    expect(redact(12.5)).toBe(12.5)
    expect(redact(true)).toBe(true)
    expect(redact(false)).toBe(false)
    expect(redact(123456789)).toBe(123456789) // 9 digits, not an IC shape
    expect(redact('Soalan tanpa data peribadi.')).toBe('Soalan tanpa data peribadi.')
  })

  it('a clean text is returned as it was, byte for byte (also a text that looks like JSON)', () => {
    for (const text of ['[2, 4,   6]', '{"a": 1}', '  spasi  dua  ', '"petikan"']) expect(redact(text)).toBe(text)
  })

  it('is idempotent: redacting twice gives the same result', () => {
    const corpus: unknown[] = [
      'Hubungi 012-345 6789 selepas waktu sekolah.',
      `Penulis ${PII.name1} dan Zoë Fiktif Contoh`,
      '<p>03-1234 5678</p>',
      PII.username1,
      'Kod 4420 abc 79460958 tamat',
      '{"a":"IC 900101-14-5555","n":3}',
      { a: 'a@leak-check.invalid', n: [1, 'x 012-345 6789'] },
      900101145555,
      T,
      `${T} dan ${T}`,
    ]
    for (const v of corpus) {
      const once = redact(v)
      expect(redact(once), JSON.stringify(v)).toEqual(once)
    }
  })

  it('the token matches no scan pattern and no question-bank pii kind other than "redacted"', () => {
    expect(patternKinds(T)).toEqual([])
    expect(scanHits(T)).toEqual([])
    expect(piiKindsOf(T)).toEqual(['redacted'])
    expect(piiKindsOf(`Soalan ${T} habis`)).toEqual(['redacted'])
    expect(piiKindsOf('Soalan biasa')).not.toContain('redacted')
  })
})

describe('redact-pii: json', () => {
  it('redacts every string leaf of an object, keeps keys, numbers, booleans and null', () => {
    const value = { 'no. 012-345 6789': 'ok', a: 'Hubungi 012-345 6789', n: 3, f: 1.5, b: true, z: null, nested: { s: ['a@leak-check.invalid', 2, 'biasa'], who: PII.username1 } }
    expect(redact(value)).toEqual({ 'no. 012-345 6789': 'ok', a: `Hubungi ${T}`, n: 3, f: 1.5, b: true, z: null, nested: { s: [T, 2, 'biasa'], who: T } })
    expect(scanHits(redact(value))).toEqual([])
  })

  it('a clean object is returned as it was', () => {
    const value = { a: 'x', n: [1, 2], z: null }
    expect(redact(value)).toBe(value)
  })

  it('a long integer that the scan would flag becomes the token; other numbers stay numbers', () => {
    expect(scanHits({ id: 900101145555 })).toEqual(['ic'])
    expect(redact({ id: 900101145555, k: 7 })).toEqual({ id: T, k: 7 })
    expect(redact(900101145555)).toBe(T)
    expect(scanHits(redact({ id: 900101145555 }))).toEqual([])
  })

  it('json held in a text cell: parsed, string leaves redacted, keys and numbers kept, written back as json', () => {
    const text = '{"soalan":"Hubungi 012-345 6789","markah":3,"betul":true,"tiada":null,"pilihan":["A","IC 900101-14-5555"]}'
    const out = redact(text) as string
    expect(JSON.parse(out)).toEqual({ soalan: `Hubungi ${T}`, markah: 3, betul: true, tiada: null, pilihan: ['A', `IC ${T}`] })
    expect(scanHits(out)).toEqual([])
    expect(JSON.parse(redact('["a@leak-check.invalid"]') as string)).toEqual([T])
    expect(JSON.parse(redact('"a@leak-check.invalid"') as string)).toBe(T)
  })

  it('text that only looks like json (not valid) is redacted as text', () => {
    expect(redact('{pilih 012-345 6789}')).toBe(`{pilih ${T}}`)
    expect(redact('[1, 2, "x 012-345 6789"')).toBe(`[1, 2, "x ${T}"`)
  })
})

describe('redact-pii: guarantee by construction', () => {
  // A seeded generator of strings made of the pieces that matter: digits, separators, a name, an e-mail, words, sigma.
  function rng(seed: number): () => number {
    let s = seed >>> 0
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0
      return s / 0x100000000
    }
  }
  const pieces = [
    '0', '1', '2', '3', '6', '9', '01', '012', '345', '6789', '12', '-', ' ', ' ', '  ', '+', '+60', '60', '0123456789', '03-1234 5678', '900101-14-5555', '880808088888',
    '4420', '7946', '0958', '+44 20 7946 0958', 'a@b.invalid', 'x@leak-check.invalid', '@', '.', 'Qwertyus', 'Plorbinski', 'qwertyus plorbinski', 'Contoh', 'biasa', 'fiktif', 'Zoë', 'ΟΔΟΣ', 'ΦΙΚΤΙΒΟΣ',
    'abc', '<p>', '</p>', '"', '{', '}', '[', ']', 'qplorbinski_7', '\n', 'é', 'ë',
  ]

  it('the leak scan finds nothing in the output, and a second pass changes nothing (5000 random cells)', () => {
    const next = rng(20241024)
    let changed = 0
    for (let i = 0; i < 5000; i++) {
      const n = 1 + Math.floor(next() * 14)
      let text = ''
      for (let k = 0; k < n; k++) text += pieces[Math.floor(next() * pieces.length)]
      const out = redact(text) as string
      expect(scanHits(out), `case ${i}`).toEqual([])
      expect(patternKinds(out), `case ${i}`).toEqual([])
      expect(redact(out), `case ${i}`).toBe(out)
      if (out !== text) changed++
    }
    expect(changed).toBeGreaterThan(500) // the generator does hit the patterns
  })

  it('fails closed: a cell that is still flagged but has no span to cut becomes the token', () => {
    const stub = { spans: () => [] as PiiSpan[], match: (t: string) => (t === T ? null : 'original-name') } as unknown as OriginalsIndex
    expect(new PiiRedactor(stub).redact('Teks biasa sahaja')).toBe(T)
  })

  it('applyRule redact-pii uses the given redactor and counts by kind; without one it still masks the patterns', () => {
    const counted: RedactKind[] = []
    expect(applyRule({ rule: 'redact-pii' }, `Nama ${PII.name1} tel 012-345 6789`, pseudo, false, { redactor, onRedact: (k) => counted.push(k) })).toBe(`Nama ${T} tel ${T}`)
    expect(counted.sort()).toEqual(['original-name', 'phone'])
    expect(applyRule({ rule: 'redact-pii' }, 'tel 012-345 6789', pseudo)).toBe(`tel ${T}`)
    expect(applyRule({ rule: 'redact-pii' }, null, pseudo)).toBeNull()
    expect(applyRule({ rule: 'redact-pii' }, '', pseudo)).toBe('')
    expect(parseConfig({ version: 1, tables: { questions: { body: 'redact-pii' } } }).tables.questions?.body).toEqual({ rule: 'redact-pii' })
  })

  it('a value that redact-pii leaves is never recorded in the originals index (public content is not an original)', () => {
    const idx = new OriginalsIndex()
    const text = 'Soalan awam yang panjang tentang pecahan dan perpuluhan sahaja.'
    idx.record({ rule: 'redact-pii' }, text, text)
    expect(idx.size).toBe(0)
    expect(idx.match(text)).toBeNull()
  })
})
