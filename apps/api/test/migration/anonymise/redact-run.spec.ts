/**
 * `redact-pii` through the whole anonymise run (A1-LEAK, route 4) with the SHIPPED config: fake PII is planted in question
 * bodies, options, explanations, stimuli, answer keys, an article title and a banner target; the run must succeed, the leak
 * scan (unchanged, `leakScan.allow` empty) must be clean, the text around the PII must be kept and the token present.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ANON_EXIT, runAnonymiseCli } from '../../../src/migration/anonymise/cli'
import { LeakScanError } from '../../../src/migration/anonymise/errors'
import { patternKinds } from '../../../src/migration/anonymise/leak-scan'
import { REDACTED_TOKEN } from '../../../src/migration/anonymise/redact'
import { runAnonymise, type AnonymiseResult } from '../../../src/migration/anonymise/run'
import { parseConfig } from '../../../src/migration/anonymise/rules'
import { DirReader } from '../../../src/migration/staging/readers'
import { allText, capture, originalValues, PII, piiTables, readDump, scratch, TEST_KEY, writeDump, type Rows } from './helpers'

const T = REDACTED_TOKEN
/** Held ONLY by `sponsors.officer_name`, a table that comes after `articles` in the table order. */
const LATE_NAME = 'Vexilor Quendrath'
const work = scratch()
afterAll(() => work.cleanup())

const configJson = JSON.parse(readFileSync(fileURLToPath(new URL('../../../src/migration/anonymise/anon.config.json', import.meta.url)), 'utf8')) as Record<string, unknown>
const config = parseConfig(configJson)

/** The users fixture plus content rows. `sponsors` (and `schools`) come AFTER `articles` in the table order. */
function contentTables(): Record<string, Rows> {
  return {
    ...piiTables(),
    sponsors: [...(piiTables().sponsors as Rows), { id: 2, organisation: 'Syarikat Fiktif', category: 'korporat', officer_name: LATE_NAME, status: 'aktif' }],
    articles: [
      { id: 1, slug: 'tips-belajar-matematik-spm', category: 'tips', title: `Wawancara dengan ${LATE_NAME} tentang SPM`, views: 3, is_published: '1', author_id: 1, created_at: '2026-01-01T00:00:00Z' },
      { id: 2, slug: 'tips-belajar-matematik-spm-2', category: 'tips', title: 'Tajuk biasa tanpa data peribadi', views: 0, is_published: '1', author_id: 2 },
      // a slug that holds an original name (the flagged articles.slug original-name), a NULL slug, and a duplicate of row 1's slug
      { id: 3, slug: 'wawancara-qwertyus-plorbinski', category: 'tips', title: 'Satu', views: 1, is_published: '1', author_id: 1 },
      { id: 4, slug: null, category: 'tips', title: 'Dua', views: 1, is_published: '1', author_id: 1 },
      { id: 5, slug: 'tips-belajar-matematik-spm', category: 'tips', title: 'Tiga', views: 1, is_published: '1', author_id: 1 },
    ],
    // other KEPT cells that equal an old article slug or an old banner link: the replaced originals are content, not PII, so they are not indexed
    videos: [
      { id: 1, title: 'Video satu', url: 'tips-belajar-matematik-spm', duration_seconds: 60 },
      { id: 2, title: 'Video dua', url: 'https://promo.example.test/kempen-hari-raya', duration_seconds: 90 },
    ],
    banners: [
      { id: 4, title: 'Kempen', type: 'promo', target: 'https://promo.example.test/kempen-hari-raya', image_path: null, is_active: '1' },
      { id: 1, title: 'Promosi', type: 'promo', target: `mailto:${PII.email2}`, image_path: 'banner/a.png', is_active: '1' },
      { id: 2, title: 'Tanpa pautan', type: 'hero', target: null, image_path: null, is_active: '1' },
      { id: 3, title: 'Kosong', type: 'hero', target: '', image_path: null, is_active: '1' },
    ],
    questions: [
      { id: 1, subject_id: 1, education_level_id: 1, difficulty_level: '3', type: 'mcq', status: 'diluluskan', body: `Hubungi ${PII.name1} di ${PII.phone1} untuk jawapan bagi 12 + 3.`, explanation: `Sebab: 12 + 3 = 15. Mel ${PII.email2} atau IC ${PII.ic2}.`, image_path: null },
      { id: 2, subject_id: 1, education_level_id: 1, difficulty_level: '1', type: 'mcq', status: 'diluluskan', body: '<p>Pejabat: 03-1234 5678</p><p>Berapakah 2 + 2?</p>', explanation: null, image_path: null },
      { id: 3, subject_id: 1, education_level_id: 1, difficulty_level: '1', type: 'mcq', status: 'diluluskan', body: 'Soalan biasa tanpa data peribadi.', explanation: '', image_path: null },
    ],
    question_options: [
      { id: 1, question_id: 1, label: 'A', body: `Telefon ${PII.phone2} (ibu)`, image_path: null, is_correct: '0' },
      { id: 2, question_id: 1, label: 'B', body: 'Empat', image_path: null, is_correct: '1' },
      { id: 3, question_id: 2, label: 'A', body: PII.username2, image_path: null, is_correct: '0' },
      { id: 4, question_id: 3, label: 'A', body: '0123456789', image_path: null, is_correct: '1' },
    ],
    part_options: [{ id: 1, question_part_id: 1, label: 'A', body: `Guru ${PII.name2} berkata` }],
    stimuli: [{ id: 1, stimulus_kind_id: 1, body: `Petikan oleh ${PII.name1}: "hubungi ${PII.email1}".` }],
    part_answer_keys: [{ id: 1, question_part_id: 1, answer_key_kind_id: 1, content: `Jawapan: ${PII.ic1} (lihat ${PII.phone1})` }],
    structured_questions: [{ id: 1, subject_id: 1, status: 'diluluskan', stimulus: `Petikan: ${PII.name2} (${PII.phone2}) menulis.` }],
  }
}

let source: string
let out: string
let result: AnonymiseResult
let log: ReturnType<typeof capture>

beforeAll(async () => {
  source = work.out('content-src')
  writeDump(source, contentTables())
  out = work.out('content-out')
  log = capture()
  result = await runAnonymise({
    reader: new DirReader(source),
    outDir: out,
    config,
    key: Buffer.from(TEST_KEY, 'utf8'),
    sourceDir: source,
    log: { info: log.out, warn: log.out, error: log.err } as never,
  })
})

describe('anonymise run with redact-pii (shipped config)', () => {
  it('succeeds, the leak scan is clean with an empty allow list, and no original survives in any file', () => {
    expect(result.scan.hits).toEqual([])
    expect(config.leakScan.allow).toEqual([])
    expect(log.text()).toMatch(/Leak scan: clean/)
    const text = allText(out)
    expect(text).not.toContain(LATE_NAME)
    for (const original of originalValues()) expect(text.includes(original), `leaked: ${original.slice(0, 4)}...`).toBe(false)
  })

  it('masks the planted PII in question bodies, options, explanations, stimuli, answer keys and an article title; keeps the text around it', () => {
    const o = readDump(out)
    const q = o.questions as Rows
    expect(q[0]?.body).toBe(`Hubungi ${T} di ${T} untuk jawapan bagi 12 + 3.`)
    expect(q[0]?.explanation).toBe(`Sebab: 12 + 3 = 15. Mel ${T} atau IC ${T}.`)
    expect(q[1]?.body).toBe(`<p>Pejabat: ${T}</p><p>Berapakah 2 + 2?</p>`)
    expect(q[1]?.explanation).toBeNull()
    expect(q[2]).toMatchObject({ body: 'Soalan biasa tanpa data peribadi.', explanation: '' })
    const opts = o.question_options as Rows
    expect(opts[0]?.body).toBe(`Telefon ${T} (ibu)`)
    expect(opts[1]?.body).toBe('Empat')
    expect(opts[2]?.body).toBe(T) // an option that is exactly an indexed original value
    expect(opts[3]?.body).toBe(T) // a maths string with the shape of a phone number: masked, and QLOAD will hold the question
    expect((o.part_options as Rows)[0]?.body).toBe(`Guru ${T} berkata`)
    expect((o.stimuli as Rows)[0]?.body).toBe(`Petikan oleh ${T}: "hubungi ${T}".`)
    expect((o.part_answer_keys as Rows)[0]?.content).toBe(`Jawapan: ${T} (lihat ${T})`)
    expect((o.structured_questions as Rows)[0]?.stimulus).toBe(`Petikan: ${T} (${T}) menulis.`)
    const a = o.articles as Rows
    expect(a[0]?.title).toBe(`Wawancara dengan ${T} tentang SPM`) // the name comes from `sponsors`, a table AFTER articles
    expect(a[1]?.title).toBe('Tajuk biasa tanpa data peribadi')
  })

  it('the index pass makes the index complete: a name that only a LATER table holds is masked in an earlier table', () => {
    expect(log.text()).toMatch(/Index pass: originals of \d+ table\(s\) indexed for redact-pii/)
    const tableOrder = result.tables.map((t) => t.table)
    expect(tableOrder.indexOf('articles')).toBeLessThan(tableOrder.indexOf('sponsors'))
    expect(tableOrder.indexOf('questions')).toBeGreaterThan(tableOrder.indexOf('sponsors'))
  })

  it('keeps ids and structure, NULL and "" stay, and no scan pattern remains in any string', () => {
    const input = contentTables()
    const o = readDump(out)
    for (const table of ['articles', 'banners', 'questions', 'question_options', 'stimuli', 'part_answer_keys']) {
      ;(input[table] as Rows).forEach((row, i) => {
        const r = (o[table] as Rows)[i] as Record<string, unknown>
        expect(Object.keys(r)).toEqual(Object.keys(row))
        expect(r.id).toBe(row.id)
        for (const [c, v] of Object.entries(row)) {
          if (v === null) expect(r[c], `${table}.${c}`).toBeNull()
          if (v === '') expect(r[c], `${table}.${c}`).toBe(table === 'banners' && c === 'target' ? null : '') // the `null` rule empties it
        }
      })
    }
    const walk = (v: unknown): void => {
      if (typeof v === 'string') expect(patternKinds(v), v).toEqual([])
      else if (Array.isArray(v)) v.forEach(walk)
      else if (v && typeof v === 'object') Object.values(v).forEach(walk)
    }
    for (const rows of Object.values(o)) rows.forEach(walk)
  })

  it('banner targets become NULL (v2 keeps no link without a valid http(s) target); article slugs are regenerated from the id', () => {
    const o = readDump(out)
    expect((o.banners as Rows).map((b) => b.target)).toEqual([null, null, null, null])
    const slugs = (o.articles as Rows).map((a) => String(a.slug))
    // from each row's own id, so unique (the duplicate in the source becomes distinct) and URL-safe; NULL stays NULL
    expect((o.articles as Rows).map((a) => a.slug)).toEqual(['artikel-1', 'artikel-2', 'artikel-3', null, 'artikel-5'])
    expect(slugs.filter((x) => x !== 'null')).toSatisfy((xs: string[]) => new Set(xs).size === xs.length && xs.every((x) => /^[a-z0-9-]+$/.test(x)))
    expect(JSON.stringify(o.articles)).not.toContain('tips-belajar')
    expect(JSON.stringify(o.articles)).not.toContain('qwertyus-plorbinski')
  })

  it('reports redaction counts per table.column and kind, and logs the same, with no value', () => {
    const key = (r: { table: string; column: string; kind: string }) => `${r.table}.${r.column}.${r.kind}`
    const counts = Object.fromEntries(result.redactions.map((r) => [key(r), r.count]))
    expect(counts).toMatchObject({
      'questions.body.original-name': 1,
      'questions.body.phone': 2, // 011-1111 2222 and 03-1234 5678
      'questions.explanation.email': 1,
      'questions.explanation.ic': 1,
      'question_options.body.phone': 2, // the phone and 0123456789
      'question_options.body.original-value': 1,
      'articles.title.original-name': 1,
      'stimuli.body.original-name': 1,
      'stimuli.body.email': 1,
      'part_answer_keys.content.ic': 1,
      'part_answer_keys.content.phone': 1,
      'structured_questions.stimulus.original-name': 1,
      'structured_questions.stimulus.phone': 1,
    })
    for (const r of result.redactions) {
      expect(Object.keys(r).sort()).toEqual(['column', 'count', 'kind', 'table'])
      expect(r.count).toBeGreaterThan(0)
    }
    const text = log.text()
    expect(text).toMatch(/Redacted \d+ span\(s\) in questions\.body \(/)
    expect(text).toMatch(/Redacted \d+ span\(s\) in articles\.title \(original-name x1\)\./)
    for (const original of originalValues()) expect(text.includes(original)).toBe(false)
    expect(text).not.toContain(T)
    for (const line of log.lines.filter((l) => l.startsWith('Redacted'))) expect(line).toMatch(/^Redacted \d+ span\(s\) in [a-z_]+\.[a-z_]+ \((?:(?:email|phone|ic|original-value|original-name) x\d+(?:, )?)+\)\.$/)
  })

  it('is deterministic: a second run over the same source gives byte-identical files', async () => {
    const again = work.out('content-out-2')
    const r = await runAnonymise({ reader: new DirReader(source), outDir: again, config, key: Buffer.from(TEST_KEY, 'utf8'), sourceDir: source })
    expect(r.redactions).toEqual(result.redactions)
    expect(allText(again)).toBe(allText(out))
  })

  it('runs through the CLI too (exit 0) and writes the masked text', async () => {
    const dir = work.out('content-cli')
    const l = capture()
    const code = await runAnonymiseCli(['anonymise:run', '--source', source, '--out', dir], { env: { ANON_HMAC_KEY: TEST_KEY }, out: l.out, err: l.err })
    expect(code, l.text()).toBe(ANON_EXIT.ok)
    expect(((readDump(dir).questions as Rows)[0] as Record<string, unknown>).body).toBe(`Hubungi ${T} di ${T} untuk jawapan bagi 12 + 3.`)
  })
})

describe('old slugs and links are content, not PII (the originals index does not collect them)', () => {
  it('another kept cell equal to an old slug or link passes (above), and the values are kept as they were', () => {
    const o = readDump(out)
    expect((o.videos as Rows).map((v) => v.url)).toEqual(['tips-belajar-matematik-spm', 'https://promo.example.test/kempen-hari-raya'])
  })

  it('a real name inside an old slug is still flagged where it is kept (the name is indexed from the users)', async () => {
    const tables = contentTables()
    ;(tables.videos as Rows).push({ id: 3, title: 'Video tiga', url: 'wawancara-qwertyus-plorbinski', duration_seconds: 5 })
    const dump = work.out('slug-name-src')
    writeDump(dump, tables)
    const err = await runAnonymise({ reader: new DirReader(dump), outDir: work.out('slug-name-out'), config, key: Buffer.from(TEST_KEY, 'utf8'), sourceDir: dump }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(LeakScanError)
    expect((err as LeakScanError).hits.map((h) => `${h.table}.${h.column}:${h.kind}`)).toEqual(['videos.url:original-name'])
  })
})

describe('the same fixture with `keep` instead of redact-pii (what happened on the operator host)', () => {
  it('fails the leak scan, so the new rule is what makes the run pass', async () => {
    const kept = JSON.parse(JSON.stringify(configJson)) as { tables: Record<string, Record<string, unknown>> }
    for (const [t, c] of [['questions', 'body'], ['question_options', 'body'], ['articles', 'title']] as const) kept.tables[t]![c] = 'keep'
    const dir = work.out('keep-out')
    await expect(
      runAnonymise({ reader: new DirReader(source), outDir: dir, config: parseConfig(kept), key: Buffer.from(TEST_KEY, 'utf8'), sourceDir: source }),
    ).rejects.toBeInstanceOf(LeakScanError)
  })
})
