/**
 * AZ-Dev5 (#109 A1 leak-scan analysis). Characterises the BE-35 leak-scan matchers against a
 * SYNTHETIC SPM-style corpus, so that a later change to the matchers cannot silently
 *   (a) start flagging ordinary number-heavy question text as a phone number, or
 *   (b) stop flagging a contact detail that is genuinely typed into content.
 *
 * Everything in this file is invented: no real question, person, school or contact detail.
 * This spec reads nothing and writes nothing.
 */
import { describe, expect, it } from 'vitest'

import { LeakScanner, OriginalsIndex, patternKinds } from '../../../src/migration/anonymise/leak-scan'
import type { Rule } from '../../../src/migration/anonymise/rules'

const NAME: Rule = { rule: 'pseudonym', kind: 'name' }
const PHONE: Rule = { rule: 'pseudonym', kind: 'phone' }

/** Number-heavy SPM-style content that carries no personal data at all. */
const CLEAN = [
  'Diberi bahawa 12x + 35 = 251. Cari nilai x.',
  'Bundarkan 1 234 567 890 kepada juta yang terdekat.',
  'Harga sebuah buku ialah RM12.50. Berapakah harga 8 buah buku?',
  'Suatu jasad berjisim 2.5 kg bergerak dengan halaju 12 m s-1 selama 0.75 s.',
  'Laju cahaya ialah 3.00 x 108 m s-1 dan pemalar Planck ialah 6.63 x 10-34 J s.',
  'Hitung bilangan mol bagi 24.0 g karbon dioksida. Jisim molekul relatif ialah 44.',
  'Isotop 235 92 U dan 238 92 U mempunyai bilangan neutron yang berbeza.',
  'Markah pelajar: 45 52 61 73 88 90. Cari min dan median.',
  'Jadual menunjukkan bilangan pelajar: 23 45 67 89 12 34 56 78',
  'Kelas bermula 0800 dan tamat 1230 setiap hari.',
  'Antara tahun 1957, 1963, 1965 dan 1969 berlaku peristiwa penting.',
  'Nombor akaun 1601 2345 6789 digunakan untuk pembayaran.',
  'Nyatakan 7/16 dalam bentuk perpuluhan sehingga 4 tempat perpuluhan.',
  'Peratusan diskaun ialah 35% daripada RM1 250. Hitung harga selepas diskaun.',
]

/** Content that genuinely carries a contact-shaped string (all invented numbers/domains). */
const CONTACT = [
  ['Hubungi pejabat di 03-8888 7777 untuk maklumat lanjut.', 'phone'],
  ['Encik Rahman menerima panggilan daripada 012-3456789 pada pukul 3 petang.', 'phone'],
  ['Pelajar boleh menghubungi 019-876 5432 untuk mendaftar.', 'phone'],
  ['Hantar jawapan ke cikgu12@contohsekolah.edu.my sebelum tarikh tutup.', 'email'],
  ['Borang diminta melalui e-mel kepada urusetia@contoh.com.', 'email'],
] as const

describe('leak scan: ordinary SPM content does not look like personal data', () => {
  it('flags nothing in number-heavy question text', () => {
    for (const text of CLEAN) expect([text, patternKinds(text)]).toEqual([text, []])
  })

  it('still flags a contact detail typed into content', () => {
    for (const [text, kind] of CONTACT) expect([text, patternKinds(text)]).toEqual([text, [kind]])
  })

  it('accepts the reserved fake domain and any domain passed in', () => {
    expect(patternKinds('anon-abcd@example.test')).toEqual([])
    expect(patternKinds('ali@example.com', { allowedEmailDomains: ['example.test', 'example.com'] })).toEqual([])
    expect(patternKinds('ali@example.com')).toEqual(['email'])
  })

  it('needs a leading 0/60 and a Malaysian digit count, so bare long numbers are not phones', () => {
    expect(patternKinds('123456789')).toEqual([]) // 9 digits, no 0
    expect(patternKinds('1234567890')).toEqual([]) // 10 digits, no 0
    expect(patternKinds('012345678')).toEqual([]) // 9 digits, 2nd digit 1 -> too short for mobile
    expect(patternKinds('0123456789')).toEqual(['phone']) // 10 digits, mobile shape
    expect(patternKinds('034567890')).toEqual(['phone']) // 9 digits, landline shape
    expect(patternKinds('012345678901')).toEqual([]) // 12 digits, too long
    expect(patternKinds('0.123456789')).toEqual([]) // a decimal is not a phone
  })

  it('only treats a valid month and day as an IC', () => {
    expect(patternKinds('991231-10-1234')).toEqual(['ic'])
    expect(patternKinds('991301-10-1234')).toEqual([]) // month 13
    expect(patternKinds('990132-10-1234')).toEqual([]) // day 32
  })
})

describe('leak scan: original-name on free-text content', () => {
  /** A two-token role phrase used as an account name makes every sentence containing it a hit. */
  it('flags ordinary prose when a role phrase is an account name', () => {
    const index = new OriginalsIndex()
    index.record(NAME, 'Guru Besar', 'Nama Anon A')
    expect(index.match('Guru Besar telah mengumumkan jadual peperiksaan percubaan.')).toBe('original-name')
  })

  /** A character name invented by a question writer collides with a real account of the same name. */
  it('cannot tell a coincidence from a leak', () => {
    const index = new OriginalsIndex()
    index.record(NAME, 'Ahmad bin Ismail', 'Nama Anon B')
    // Same text either way: an account of that name exists, and the question simply names a character.
    expect(index.match('Ahmad bin Ismail membeli 5 biji epal. Berapakah jumlah bayarannya?')).toBe('original-name')
  })

  it('does not match a single token of a name on its own', () => {
    const index = new OriginalsIndex()
    index.record(NAME, 'Ahmad bin Ismail', 'Nama Anon B')
    expect(index.match('Ahmad membeli 5 biji epal.')).toBeNull()
  })

  /** A slug and a URL path tokenise the same way, so a name inside one is matched too. */
  it('matches a name inside a slug or a banner target', () => {
    const index = new OriginalsIndex()
    index.record(NAME, 'Nurul binti Hassan', 'Nama Anon C')
    expect(index.match('kisah-kejayaan-nurul-binti-hassan-dalam-spm')).toBe('original-name')
    expect(index.match('/artikel/nurul-binti-hassan')).toBe('original-name')
  })

  it('leaves number-heavy content alone even with a large index', () => {
    const index = new OriginalsIndex()
    for (let i = 0; i < 2000; i++) {
      index.record(NAME, `Nama${i} bin Bapa${i % 97}`, `Nama Anon ${i}`)
      index.record(PHONE, `01${i % 10}-${String(1000000 + i)}`, '0012345678901')
    }
    for (const text of CLEAN) expect([text, index.match(text)]).toEqual([text, null])
  })
})

describe('leak scan: the scanner reports places and counts only', () => {
  it('never carries a value into a hit', () => {
    const scanner = new LeakScanner()
    scanner.scanRow('questions', { body: 'Hubungi 03-8888 7777 untuk maklumat.', explanation: null })
    const { hits } = scanner.result()
    expect(hits).toEqual([{ table: 'questions', column: 'body', kind: 'phone', count: 1 }])
    expect(JSON.stringify(hits)).not.toContain('8888')
  })
})
