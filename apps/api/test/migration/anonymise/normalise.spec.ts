/**
 * The normalised-view scan (A1-LEAK follow-up F1): personal data that a reader still sees but the raw characters hide
 * (tags, entities, zero-width characters, full-width or Arabic-Indic digits, JSON escapes) is seen by the scan, made clean by
 * `redact-pii` (the whole cell becomes the token when the raw text has no span to cut) and held by QLOAD. Every value is FAKE:
 * reserved or `.invalid` domains, patterned numbers, made-up names. Invisible characters are written as escapes.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { LeakScanner, OriginalsIndex, patternKinds } from '../../../src/migration/anonymise/leak-scan'
import { normaliseForScan, scanViews } from '../../../src/migration/anonymise/normalise'
import { Pseudonymiser } from '../../../src/migration/anonymise/pseudonyms'
import { PiiRedactor, REDACTED_TOKEN } from '../../../src/migration/anonymise/redact'
import { runAnonymise } from '../../../src/migration/anonymise/run'
import { applyRule, parseConfig, type Rule } from '../../../src/migration/anonymise/rules'
import { LeakScanError } from '../../../src/migration/anonymise/errors'
import { DirReader } from '../../../src/migration/staging/readers'
import { piiKindsOf, transformQuestion, type Curriculum, type LegacyOption, type LegacyQuestion } from '../../../src/migration/transform/question-bank'
import { allText, originalValues, PII, piiTables, readDump, scratch, TEST_KEY, writeDump, type Rows } from './helpers'

const T = REDACTED_TOKEN
const pseudo = new Pseudonymiser(Buffer.from(TEST_KEY, 'utf8'))
const NAME: Rule = { rule: 'pseudonym', kind: 'name' }

function indexOf(entries: [Rule, unknown][]): OriginalsIndex {
  const index = new OriginalsIndex()
  for (const [rule, value] of entries) index.record(rule, value, applyRule(rule, value, pseudo))
  return index
}

const FOREIGN = '+44 20 7946 0958' // not a Malaysian shape: only the index can know it
const index = indexOf([
  [NAME, PII.name1], // Qwertyus Plorbinski
  [NAME, 'Zanthor Mikkelvane Contoh'],
  [{ rule: 'pseudonym', kind: 'username' }, PII.username1], // qplorbinski_7
  [{ rule: 'pseudonym', kind: 'phone' }, FOREIGN],
])
const redactor = new PiiRedactor(index)
const redact = (v: unknown) => redactor.redact(v)
const scanHits = (value: unknown): string[] => {
  const scanner = new LeakScanner(index)
  scanner.scanRow('t', { c: value })
  return scanner.result().hits.map((h) => h.kind)
}
/** The scan of the raw text only (what the scan saw before F1): the pattern regexes and the index on the string itself. */
const rawBlind = (text: string): boolean => {
  const rawPatterns = [/(?<![\d+])(?:\+?60|0)[ -]?1\d[ -]?\d{3,4}[ -]?\d{4}(?!\d)/, /(?<![\d+])(?:\+?60|0)[ -]?[3-9][ -]?\d{3,4}[ -]?\d{4}(?!\d)/, /(?<!\d)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[ -]?\d{2}[ -]?\d{4}(?!\d)/, /[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/]
  return rawPatterns.every((re) => !re.test(text))
}

// --- the cases: [label, text, expected scan kinds] -------------------------------------------------------------------------
const ZW = '\u200b'
const phoneCases: [string, string][] = [
  ['zero-width space inside a mobile number', `Hubungi 012${ZW}-345 6789 segera`],
  ['zero-width non-joiner', 'Hubungi 012\u200c-345 6789 segera'],
  ['zero-width joiner', 'Hubungi 012-345\u200d 6789 segera'],
  ['word joiner', 'Hubungi 01\u20602-345 6789 segera'],
  ['BOM (U+FEFF)', 'Hubungi 012-345 6789\ufeff segera'],
  ['soft hyphen', 'Hubungi 012\u00ad-345 6789 segera'],
  ['full-width digits and hyphen', 'Hubungi \uff10\uff11\uff12\uff0d\uff13\uff14\uff15 \uff16\uff17\uff18\uff19 segera'],
  ['Arabic-Indic digits', 'Hubungi \u0660\u0661\u0662-\u0663\u0664\u0665 \u0666\u0667\u0668\u0669 segera'],
  ['Extended Arabic-Indic digits', 'Hubungi \u06f0\u06f1\u06f2-\u06f3\u06f4\u06f5 \u06f6\u06f7\u06f8\u06f9 segera'],
  ['Tamil digits', 'Hubungi \u0be6\u0be7\u0be8-\u0be9\u0bea\u0beb \u0bec\u0bed\u0bee\u0bef segera'],
  ['mixed ASCII and Arabic-Indic digits', 'Hubungi 01\u0662-345 \u0666789 segera'],
  ['decimal entity for the first digit', 'Hubungi &#48;12-345 6789 segera'],
  ['hex entity for the first digit', 'Hubungi &#x30;12-345 6789 segera'],
  ['entity for the hyphen', 'Hubungi 012&#45;345 6789 segera'],
  ['named entity for the hyphen', 'Hubungi 012&hyphen;345 6789 segera'],
  ['no-break space as the separator', 'Hubungi 012\u00a0345\u00a06789 segera'],
  ['&nbsp; as the separator', 'Hubungi 012&nbsp;345&nbsp;6789 segera'],
  ['double entity', 'Hubungi &amp;#48;12-345 6789 segera'],
  ['soft hyphen entity', 'Hubungi 012&shy;-345 6789 segera'],
  ['a tag around the first group', 'Hubungi <b>012</b>-345 6789 segera'],
  ['a tag between the groups', 'Hubungi 012-<span style="color:red">345</span> 6789 segera'],
  ['a tag inside a group', 'Hubungi 01<b>2-345</b> 6789 segera'],
  ['a tag without a separator between the groups', 'Hubungi 012<i>345</i>6789 segera'],
  ['two spaces between the groups', 'Hubungi 012-345  6789 segera'],
  ['a tab between the groups', 'Hubungi 012-345\t6789 segera'],
  ['an en dash between the groups', 'Hubungi 012\u2013345\u20136789 segera'],
  ['a landline with a zero-width character', `Pejabat 03${ZW}-1234 5678 buka`],
  ['a landline in Arabic-Indic digits', 'Pejabat \u0660\u0663-\u0661\u0662\u0663\u0664 \u0665\u0666\u0667\u0668 buka'],
  ['a landline split by a tag', 'Pejabat <b>03</b>-1234 5678 buka'],
]
const emailCases: [string, string][] = [
  ['&commat;', 'Mel a&commat;leak-check.invalid sekarang'],
  ['&#64;', 'Mel a&#64;leak-check.invalid sekarang'],
  ['&#x40;', 'Mel a&#x40;leak-check.invalid sekarang'],
  ['full-width @', 'Mel a\uff20leak-check.invalid sekarang'],
  ['full-width letters in the domain', 'Mel a@leak-check.\uff49\uff4e\uff56\uff41\uff4c\uff49\uff44 sekarang'],
  ['zero-width space in the local part', `Mel contoh${ZW}.fiktif@leak-check.invalid sekarang`],
  ['soft hyphen in the domain', 'Mel a@leak\u00ad-check.invalid sekarang'],
  ['&period; as the dot', 'Mel a@leak-check&period;invalid sekarang'],
  ['a tag inside the address', 'Mel contoh<b>.fiktif</b>@leak-check.invalid sekarang'],
  ['a tag around the domain', 'Mel a@<span>leak-check.invalid</span> sekarang'],
]
const icCases: [string, string][] = [
  ['IC in full-width digits', 'IC \uff19\uff10\uff10\uff11\uff10\uff11\uff0d\uff11\uff14\uff0d\uff15\uff15\uff15\uff15 ialah'],
  ['IC in Arabic-Indic digits', 'IC \u0669\u0660\u0660\u0661\u0660\u0661-\u0661\u0664-\u0665\u0665\u0665\u0665 ialah'],
  ['IC with a zero-width space', `IC 900101${ZW}-14-5555 ialah`],
  ['IC with entities for the hyphens', 'IC 900101&#45;14&#45;5555 ialah'],
  ['IC split by a tag', 'IC <b>900101</b>-14-5555 ialah'],
]
const nameCases: [string, string][] = [
  ['name split by a tag', '<b>Qwertyus</b> Plorbinski menang'],
  ['name split by a closing and an opening tag', 'Penulis <i>Qwertyus</i> <b>Plorbinski</b> menang'],
  ['name split by br', 'Penulis Qwertyus<br>Plorbinski menang'],
  ['name split by br/', 'Penulis Qwertyus<br/>Plorbinski menang'],
  ['name split by &nbsp;', 'Penulis Qwertyus&nbsp;Plorbinski menang'],
  ['name split by &#160;', 'Penulis Qwertyus&#160;Plorbinski menang'],
  ['name split by a no-break space', 'Penulis Qwertyus\u00a0Plorbinski menang'],
  ['name with a zero-width space between the letters', `Penulis Qwer${ZW}tyus Plorbinski menang`],
  ['name with a soft hyphen', 'Penulis Qwertyus Plor\u00adbinski menang'],
  ['name in full-width letters', 'Penulis \uff31\uff57\uff45\uff52\uff54\uff59\uff55\uff53 Plorbinski menang'],
  ['name with an entity for a letter', 'Penulis Qwertyus Plorbinski menang'.replace('Q', '&#81;')],
  ['name split by a paragraph break', '<p>Qwertyus</p><p>Plorbinski</p>'],
  ['name with a tag and a double space', 'Penulis <b>Qwertyus</b>   <i>Plorbinski</i>'],
  ['the whole cell is an indexed value inside a tag', '<b>qplorbinski_7</b>'],
  ['an indexed value with a zero-width space', `qplorbinski${ZW}_7`],
  ['an indexed value with &nbsp; around it', '&nbsp;qplorbinski_7&nbsp;'],
  ['an indexed phone in Arabic-Indic digits', 'Hubungi \u0664\u0664 \u0662\u0660 \u0667\u0669\u0664\u0666 \u0660\u0669\u0665\u0668 segera'],
  ['an indexed phone with a tag in the middle', 'Hubungi +44 20 <b>7946</b> 0958 segera'],
  ['an indexed phone with a zero-width space', `Hubungi +44 20 7946${ZW} 0958 segera`],
]
const jsonCases: [string, string][] = [
  ['json text, \\u escapes for the digits', '{"soalan":"Hubungi \\u0030\\u0031\\u0032-345 6789","markah":3}'],
  ['json text, a \\t inside the number', '{"soalan":"Hubungi 012-345\\t6789"}'],
  ['json text, an escaped / and \\u0040 in an e-mail', '["Mel a\\u0040leak-check.invalid"]'],
  ['json text, a tag inside a string leaf', '{"soalan":"Hubungi <b>012</b>-345 6789"}'],
  ['json text, a name split by br in a leaf', '{"p":"Qwertyus<br>Plorbinski"}'],
  ['json text, escaped full-width digits', '{"s":"\\uff10\\uff11\\uff12-345 6789"}'],
]
const all: [string, string][] = [...phoneCases, ...emailCases, ...icCases, ...nameCases, ...jsonCases]

describe('normaliseForScan', () => {
  it('renders tags as a reader sees them: an inline tag is nothing, a block tag a separator that keeps the sides apart', () => {
    expect(normaliseForScan('<b>Ali</b> bin Abu')).toBe('Ali bin Abu')
    expect(normaliseForScan('012-<span>345</span> 6789')).toBe('012-345 6789')
    expect(normaliseForScan('10<sup>3</sup> x x<sub>1</sub>')).toBe('103 x x1')
    expect(normaliseForScan('Qwertyus<br>Plorbinski')).toBe('Qwertyus | Plorbinski')
    expect(normaliseForScan('A<br/>B<p class="x">C</p>')).toBe('A | B | C') // none at either end
    expect(normaliseForScan('<p>A</p><p>B</p><br><br>C')).toBe('A | B | C') // a run of them is one
    expect(normaliseForScan('<td>60</td><td>8121</td>')).toBe('60 | 8121')
    expect(normaliseForScan('<P>x</P>')).toBe('x')
    expect(normaliseForScan('x < y and a<3 or b>2')).toBe('x < y and a<3 or b>2') // not tags
    // a phone number across a line break is NOT joined (the cost of keeping table cells and list items apart)
    expect(patternKinds('Hubungi 012-345<br>6789')).toEqual([])
    expect(patternKinds('Hubungi 012-345\n6789')).toEqual([]) // nor across a line break
    expect(normaliseForScan('a\r\nb\n\n c')).toBe('a | b | c')
  })

  it('the other tag modes: every tag a space, or every tag nothing', () => {
    expect(normaliseForScan('012-<span>345</span> 6789', 'space')).toBe('012- 345 6789')
    expect(normaliseForScan('Qwertyus<br>Plorbinski', 'join')).toBe('QwertyusPlorbinski')
    expect(normaliseForScan('Qwertyus<br>Plorbinski', 'space')).toBe('Qwertyus Plorbinski')
  })

  it('decodes numeric (decimal, hex) and the listed named entities; others stay as they are', () => {
    expect(normaliseForScan('&#48;&#x31;&#X32; &commat; &#64; &amp; &lt;b&gt; &nbsp;')).toBe('012 @ @ & <b>')
    expect(normaliseForScan('a&nbsp;b')).toBe('a b')
    expect(normaliseForScan('a&unknownentity;b &notanentity c')).toBe('a&unknownentity;b &notanentity c')
    // not valid scalar values: left as they are
    expect(normaliseForScan('&#0; &#xD800; &#1114112; &#128;')).toBe('&#0; &#xD800; &#1114112; &#128;')
    // an entity that decodes to a tag is NOT a tag
    expect(normaliseForScan('&lt;b&gt;Ali&lt;/b&gt;')).toBe('<b>Ali</b>')
    // a double encoding is read twice, not more
    expect(normaliseForScan('&amp;#48;')).toBe('0')
    expect(normaliseForScan('&amp;amp;#48;')).toBe('&#48;')
  })

  it('folds NFKC, non-ASCII digits, dashes and invisible characters, and collapses white space', () => {
    expect(normaliseForScan('\uff10\uff11\uff12')).toBe('012')
    expect(normaliseForScan('\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669')).toBe('0123456789')
    expect(normaliseForScan('\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9')).toBe('0123456789')
    expect(normaliseForScan('a\u200b\u200c\u200d\u2060\ufeff\u00adb')).toBe('ab')
    expect(normaliseForScan('x\u2013y\u2212z')).toBe('x-y-z')
    expect(normaliseForScan('  a \t  b\u00a0\u00a0c  ')).toBe('a b c')
  })

  it('returns plain ASCII text with single spaces as it is, and is idempotent', () => {
    for (const s of ['', 'Soalan biasa 12 + 3 = 15', 'x < y and a<3', '10^3 x 2_5', 'a & b']) expect(normaliseForScan(s)).toBe(s)
    for (const [, text] of all) {
      const once = normaliseForScan(text)
      expect(normaliseForScan(once), text).toBe(once)
      for (const mode of ['space', 'join'] as const) {
        const other = normaliseForScan(text, mode)
        expect(normaliseForScan(other, mode), text).toBe(other)
      }
    }
  })

  it('scanViews: no view for a plain text, a view for each difference, only for json with escapes', () => {
    expect(scanViews('Soalan biasa 12 + 3')).toEqual([])
    expect(scanViews('  trailing space ')).toEqual([])
    expect(scanViews('<b>012</b>-345')).toEqual(['012-345'])
    expect(scanViews('{"a":"\\u0030"}')).toContain('a | 0')
    expect(scanViews('{"a":"x 1"}')).toEqual([]) // no escape in it: the raw text has the leaves already
  })

  it('is linear: hostile inputs of 400k characters finish fast', () => {
    const hostile = ['<a'.repeat(200_000), '<'.repeat(400_000), '&'.repeat(400_000), '&#'.repeat(200_000), `<a ${'x'.repeat(400_000)}`, ' '.repeat(400_000) + 'x', '&#x'.repeat(130_000), '\\'.repeat(400_000), `["${'\\u0030'.repeat(60_000)}"]`, '\u200b'.repeat(400_000), '\u0660'.repeat(400_000)]
    for (const h of hostile) {
      const t0 = performance.now()
      normaliseForScan(h)
      normaliseForScan(h, 'join')
      normaliseForScan(h, 'space')
      scanViews(h)
      expect(performance.now() - t0, `${h.slice(0, 6)}`).toBeLessThan(1500)
    }
  })
})

describe('the scan sees what the raw characters hide', () => {
  it.each(all)('%s: the scan flags it', (_label, text) => {
    expect(scanHits(text), text).not.toEqual([])
  })

  it('the raw patterns are blind to most pattern cases (so the views are what catch them)', () => {
    const blind = [...phoneCases, ...emailCases, ...icCases].filter(([, t]) => rawBlind(t)).length
    expect(blind).toBeGreaterThanOrEqual(40)
  })

  it('patternKinds names the kind; the raw check is kept (an ordinary hit is still a hit)', () => {
    expect(patternKinds(`Hubungi 012${ZW}-345 6789`)).toEqual(['phone'])
    expect(patternKinds('Mel a&commat;leak-check.invalid')).toEqual(['email'])
    expect(patternKinds('IC \uff19\uff10\uff10\uff11\uff10\uff11\uff0d\uff11\uff14\uff0d\uff15\uff15\uff15\uff15')).toEqual(['ic'])
    expect(patternKinds('Hubungi 012-345 6789')).toEqual(['phone'])
    expect(patternKinds('Mel a@example.test')).toEqual([])
    expect(patternKinds('Mel a&commat;example.test')).toEqual([]) // the allowed fake domain stays allowed in the view
    expect(scanHits('Hubungi 012-345 6789 segera')).toEqual(['phone'])
    expect(scanHits('Hubungi 012-345 segera')).toEqual([])
  })

  it('the index sees the views: name, whole value and digits', () => {
    expect(scanHits('Penulis <b>Qwertyus</b> Plorbinski')).toEqual(['original-name'])
    expect(scanHits('<b>Qwertyus</b> Plorbinski')).toEqual(['original-value']) // the whole cell is the indexed name
    expect(scanHits('<b>qplorbinski_7</b>')).toEqual(['original-value'])
    expect(scanHits('Hubungi \u0664\u0664 \u0662\u0660 \u0667\u0669\u0664\u0666 \u0660\u0669\u0665\u0668')).toEqual(['original-value'])
    // a single word of a name is still not a hit, in any view
    expect(scanHits('<b>Qwertyus</b> dan <i>Plorbinski</i>')).toEqual([])
  })

  it('json held in a text cell: a phone in a plain string leaf was already seen; one hidden by JSON escapes was not', () => {
    expect(rawBlind('{"q":"Hubungi 012-345 6789"}')).toBe(false) // the raw text holds the number: seen before F1
    expect(rawBlind('{"q":"Hubungi \\u0030\\u0031\\u0032-345 6789"}')).toBe(true) // not before F1
    expect(patternKinds('{"q":"Hubungi \\u0030\\u0031\\u0032-345 6789"}')).toEqual(['phone'])
  })
})

describe('redact-pii makes every case clean, raw and normalised', () => {
  it.each(all)('%s: the output scans clean, holds the token, and a second pass changes nothing', (_label, text) => {
    const out = redact(text) as string
    expect(out, text).toContain(T)
    expect(scanHits(out), text).toEqual([])
    expect(patternKinds(out), text).toEqual([])
    expect(scanViews(out).some((v) => patternKinds(v).length > 0)).toBe(false)
    expect(redact(out)).toBe(out)
  })

  it('the raw span is still cut when the raw text has one (the text around it is kept)', () => {
    expect(redact('Hubungi 012-345 6789 selepas waktu sekolah.')).toBe(`Hubungi ${T} selepas waktu sekolah.`)
    expect(redact('Dua nombor: 012-345 6789 dan 013-222 3333.')).toBe(`Dua nombor: ${T} dan ${T}.`)
  })

  it('a cell with only a view-only hit becomes the whole token; a cell with the span in the raw text keeps its text', () => {
    expect(redact(`Hubungi 012${ZW}-345 6789 segera`)).toBe(T)
    expect(redact('<p>Hubungi 012-345 6789</p>')).toBe(`<p>Hubungi ${T}</p>`)
  })

  it('json text: a leaf with escapes goes to the token, the rest of the json stays valid and unchanged', () => {
    const out = redact('{"soalan":"Hubungi \\u0030\\u0031\\u0032-345 6789","markah":3,"betul":true}') as string
    expect(JSON.parse(out)).toEqual({ soalan: `Hubungi ${T}`, markah: 3, betul: true })
    const nl = redact('{"soalan":"Hubungi 012-345\\t6789","k":"biasa"}') as string
    expect(JSON.parse(nl)).toEqual({ soalan: T, k: 'biasa' })
  })

  it('an object (json column) is handled leaf by leaf with the views', () => {
    const out = redact({ a: `Hubungi 012${ZW}-345 6789`, b: 'biasa', c: ['<b>Qwertyus</b> Plorbinski', 2] })
    expect(out).toEqual({ a: T, b: 'biasa', c: [T, 2] })
    expect(scanHits(out)).toEqual([])
  })

  it('counts the kind of a whole-cell token from a view hit (pattern kind or index kind)', () => {
    const kinds: string[] = []
    redactor.redact(`Hubungi 012${ZW}-345 6789`, (k) => kinds.push(k))
    redactor.redact('Penulis <b>Qwertyus</b> Plorbinski', (k) => kinds.push(k))
    expect(kinds).toEqual(['phone', 'original-name'])
  })
})

describe('normal SPM content is unchanged and not flagged', () => {
  const clean = [
    'Hitung 3 + 4 = 7',
    'Cari 12-34 + 56-78',
    'Tahun 2024-10-24 dan 1234 5678',
    'Kira 3.14159 x 2',
    'Nilai 0.5 + 0.25 = 0.75',
    'Jumlah 1,234,567 dan 40 5678',
    'x = 03 - 12',
    '<p>Ini 2 + 3 = 5</p>',
    '<table><tr><td>60</td><td>8121</td><td>6362</td></tr><tr><td>0</td><td>4</td><td>337</td></tr></table>', // cells are not one number
    '<ol><li>7842</li><li>04378</li><li>4174</li><li>13</li></ol>',
    '<b>Soalan 12</b><br>Selesaikan 9.15 + 3433<br>03<br>71801400',
    '10<sup>3</sup> x 2<sup>5</sup> = 32 000',
    '<p>x<sub>1</sub> + x<sub>2</sub> = 12</p>',
    'Luas = 3&nbsp;m x 4&nbsp;m = 12&nbsp;m<sup>2</sup>',
    '<table><tr><td>2023</td><td>1234</td></tr><tr><td>5678</td><td>90</td></tr></table>',
    'Jika 0 &lt; a &lt; 1 dan b &gt; 2, maka a&nbsp;&lt;&nbsp;b',
    'Hasil: 1 234 567 \u00d7 10\u00b3 \u2248 3,14 \u00f7 2 \u2212 5',
    '\u0645\u062b\u0627\u0644: \u0661 + \u0662 = \u0663', // a few Arabic-Indic digits (Jawi) in a short sum
    '<b>Soalan 1</b><br>Berapakah 5 + 5?<br>',
    'Pecahan 1/2 + 1/4 = 3/4',
    'Masa 08:30 hingga 10:45 (2 jam 15 minit)',
    'RM 1 000 000 dan 2 500 000 000',
    'Julat 2010\u20132015 dan 100\u2013200',
  ]
  it.each(clean.map((t) => [t]))('%s', (text) => {
    expect(patternKinds(text), text).toEqual([])
    expect(scanHits(text), text).toEqual([])
    expect(redact(text), text).toBe(text)
    expect(piiKindsOf(text), text).toEqual([])
  })

  it('the existing false-positive guards still hold on the views of an HTML maths text', () => {
    // the join view makes 10<sup>3</sup> into 103 and x<sub>1</sub> into x1: neither is landline-shaped
    expect(piiKindsOf('0<sup>3</sup>1234 5678')).toEqual(['phone']) // joined 031234 5678 is a landline shape: held (a known cost)
    expect(piiKindsOf('10<sup>3</sup> 2<sub>10</sub>')).toEqual([])
  })
})

describe('QLOAD: piiKindsOf reads the same normalised views', () => {
  it.each([...phoneCases, ...[0, 1, 3, 5].map((i) => jsonCases[i] as [string, string])])('%s: held as phone', (_label, text) => {
    expect(piiKindsOf(text), text).toContain('phone')
  })
  it.each([...emailCases, jsonCases[2] as [string, string]])('%s: held as email', (_label, text) => {
    expect(piiKindsOf(text), text).toContain('email')
  })
  it.each(icCases)('%s: held as ic', (_label, text) => {
    expect(piiKindsOf(text), text).toContain('ic')
  })

  it('keeps its fixed kind order and adds a view kind once', () => {
    expect(piiKindsOf(`Mel a&commat;leak-check.invalid atau 012${ZW}-345 6789 dan IC 900101-14-5555`)).toEqual(['ic', 'phone', 'email'])
    expect(piiKindsOf(`${T} dan 012${ZW}-345 6789`)).toEqual(['phone', 'redacted'])
  })

  const cur: Curriculum = {
    subjects: new Map([['1', '101']]),
    levels: new Map([['1', '201']]),
    chapters: new Map(),
    topics: new Map(),
    levelCodes: new Map([['201', 'D1']]),
    topicChapter: new Map(),
  }
  const opt = (label: string, body: string, correct: string): LegacyOption => ({ id: null, label, body, image_path: null, is_correct: correct })
  const question = (over: Record<string, string | null>, options: LegacyOption[]): LegacyQuestion =>
    ({ id: '7', subject_id: '1', education_level_id: '1', difficulty_level: '3', type: 'mcq', status: 'diluluskan', body: 'Soalan contoh?', explanation: 'Sebab.', image_path: null, ...over, options }) as unknown as LegacyQuestion
  const plan = (q: LegacyQuestion) => {
    const out = transformQuestion(q, cur)
    if (!out.ok) throw new Error('rejected')
    return out.value
  }
  const three = [opt('A', 'Satu', '0'), opt('B', 'Dua', '1'), opt('C', 'Tiga', '0')]

  it('holds a question whose stem, option or explanation carries a hidden number, inactive, counted, no text in the issue', () => {
    const stem = plan(question({ body: `Hubungi 012${ZW}-345 6789 sekarang` }, three))
    expect(stem.is_active).toBe(false)
    expect(stem.notes).toContain('held_pii_suspect')
    expect(stem.import_issues).toEqual([{ code: 'pii_suspect', target: 'stem', kind: 'phone' }])
    const arabic = plan(question({}, [opt('A', 'Satu', '0'), opt('B', 'Telefon \u0660\u0661\u0662-\u0663\u0664\u0665 \u0666\u0667\u0668\u0669', '1'), opt('C', 'Tiga', '0')]))
    expect(arabic.import_issues).toEqual([{ code: 'pii_suspect', target: 'option', label: 'B', kind: 'phone' }])
    const explanation = plan(question({ explanation: 'Mel a&commat;leak-check.invalid' }, three))
    expect(explanation.import_issues).toEqual([{ code: 'pii_suspect', target: 'explanation', kind: 'email' }])
    expect(JSON.stringify([stem, arabic, explanation].map((p) => p.import_issues))).not.toMatch(/6789|leak-check|\u0660/)
  })

  it('a clean question is still loaded active', () => {
    expect(plan(question({ body: '<p>Berapakah 10<sup>3</sup> + 2<sub>1</sub>?</p>' }, three)).is_active).toBe(true)
  })
})

describe('run level: obfuscated personal data in the shipped config', () => {
  const work = scratch()
  const configJson = JSON.parse(readFileSync(fileURLToPath(new URL('../../../src/migration/anonymise/anon.config.json', import.meta.url)), 'utf8')) as Record<string, unknown>
  const config = parseConfig(configJson)
  const planted = {
    name: '<b>Qwertyus</b> Plorbinski',
    phone: 'Telefon \u0660\u0661\u0661-\u0661\u0661\u0661\u0661 \u0662\u0662\u0662\u0662 sahaja', // PII.phone1 in Arabic-Indic digits
    zw: `Hubungi 012${ZW}-345 6789`,
    mail: 'Mel a&commat;leak-check.invalid',
  }
  const tables = (): Record<string, Rows> => ({
    // only the identity tables that stay staged: nothing is planted in the columns that PDPA-MIN (#304) stops staging
    ...Object.fromEntries(['schools', 'users', 'support_tickets', 'timeline_entries', 'settings'].map((t) => [t, piiTables()[t] as Rows])),
    questions: [
      { id: 1, subject_id: 1, education_level_id: 1, difficulty_level: '3', type: 'mcq', status: 'diluluskan', body: `Soalan 12 + 3. ${planted.name}`, explanation: planted.mail, image_path: null },
      { id: 2, subject_id: 1, education_level_id: 1, difficulty_level: '1', type: 'mcq', status: 'diluluskan', body: '<p>10<sup>3</sup> x 2 = 2 000</p>', explanation: null, image_path: null },
    ],
    question_options: [
      { id: 1, question_id: 1, label: 'A', body: planted.phone, image_path: null, is_correct: '0' },
      { id: 2, question_id: 1, label: 'B', body: planted.zw, image_path: null, is_correct: '1' },
      { id: 3, question_id: 2, label: 'A', body: 'Seribu', image_path: null, is_correct: '1' },
    ],
  })

  it('the run passes, the obfuscated cells are the token, clean cells are untouched, and nothing leaks', async () => {
    const source = work.out('src')
    writeDump(source, tables())
    const out = work.out('out')
    const result = await runAnonymise({ reader: new DirReader(source), outDir: out, config, key: Buffer.from(TEST_KEY, 'utf8'), sourceDir: source })
    expect(result.scan.hits).toEqual([])
    const o = readDump(out)
    expect((o.questions as Rows)[0]).toMatchObject({ body: T, explanation: T })
    expect((o.questions as Rows)[1]).toMatchObject({ body: '<p>10<sup>3</sup> x 2 = 2 000</p>', explanation: null })
    expect((o.question_options as Rows).map((r) => r.body)).toEqual([T, T, 'Seribu'])
    const text = allText(out)
    for (const original of originalValues()) expect(text.includes(original), `leaked: ${original.slice(0, 4)}...`).toBe(false)
    const counted = Object.fromEntries(result.redactions.map((r) => [`${r.table}.${r.column}.${r.kind}`, r.count]))
    expect(counted).toMatchObject({ 'questions.body.original-name': 1, 'questions.explanation.email': 1, 'question_options.body.original-value': 1, 'question_options.body.phone': 1 })
  })

  it('with `keep` on those columns the (stricter) leak scan stops the run and names the columns, never the values', async () => {
    const kept = JSON.parse(JSON.stringify(configJson)) as { tables: Record<string, Record<string, unknown>> }
    for (const [t, c] of [['questions', 'body'], ['questions', 'explanation'], ['question_options', 'body']] as const) kept.tables[t]![c] = 'keep'
    const source = work.out('src-keep')
    writeDump(source, tables())
    const err = await runAnonymise({ reader: new DirReader(source), outDir: work.out('out-keep'), config: parseConfig(kept), key: Buffer.from(TEST_KEY, 'utf8'), sourceDir: source }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(LeakScanError)
    const hits = (err as LeakScanError).hits.map((h) => `${h.table}.${h.column}:${h.kind}`)
    expect(hits).toContain('questions.body:original-name')
    expect(hits).toContain('questions.explanation:email')
    expect(hits).toContain('question_options.body:original-value')
    expect(hits).toContain('question_options.body:phone')
    expect(JSON.stringify((err as LeakScanError).hits)).not.toMatch(/Qwertyus|leak-check|6789/)
  })
})

describe('fuzz: the guarantee holds on obfuscated random cells', () => {
  function rng(seed: number): () => number {
    let s = seed >>> 0
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0
      return s / 0x100000000
    }
  }
  const pieces = [
    '0', '1', '2', '3', '6', '9', '012', '345', '6789', '-', ' ', '  ', '\t', '+60', '60', '03-1234 5678', '900101-14-5555', '4420', '7946', '0958', '+44 20 7946 0958', 'a@b.invalid',
    '@', '.', 'Qwertyus', 'Plorbinski', 'qplorbinski_7', 'abc', 'biasa', '<b>', '</b>', '<br>', '<p>', '</p>', '<span x="1">', '</span>', '&nbsp;', '&#48;', '&#x31;', '&commat;', '&#64;', '&amp;',
    '&lt;', '&hyphen;', '\u200b', '\u00ad', '\ufeff', '\u2060', '\u0660', '\u0661', '\u06f2', '\uff10', '\uff11', '\uff0d', '\u00a0', '\u2013', '"', '{', '}', '[', ']', '\\u0030', '\\n', '<', '>', '&', ';',
  ]
  it('the output scans clean (raw and normalised) and redacting again changes nothing (6000 random cells)', () => {
    const next = rng(20261025)
    let changed = 0
    for (let i = 0; i < 6000; i++) {
      const n = 1 + Math.floor(next() * 16)
      let text = ''
      for (let k = 0; k < n; k++) text += pieces[Math.floor(next() * pieces.length)]
      const out = redact(text) as string
      expect(scanHits(out), `case ${i}`).toEqual([])
      expect(patternKinds(out), `case ${i}`).toEqual([])
      expect(redact(out), `case ${i}`).toBe(out)
      if (out !== text) changed++
    }
    expect(changed).toBeGreaterThan(500)
  })
})
