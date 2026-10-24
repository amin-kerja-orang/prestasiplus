/**
 * DSKP-T01: generator drift and whitelist (design §3.1, §3.3 `drift.test.ts`, NFR-07).
 * Re-running the generator must reproduce the committed files byte for byte; the output holds no
 * field and no text from the whitelist-excluded fields of the extracts (panel or committee text,
 * notes columns, descriptions); and no personal name or honorific.
 */

import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import {
  DSKP_VERSION,
  FIELD_SPECS,
  OUTPUT_DIR,
  buildDskp,
  readSourceFromRepo,
  textDefects,
} from '../../../../../scripts/fixtures/build-m03-dskp'
import { DSKP_SUBJECTS } from '../../dskp/subjects'

import { loadVersion, readRepo } from './helpers'

const built = buildDskp(readSourceFromRepo)

describe('DSKP generator drift (DSKP-T01)', () => {
  it('writes 15 files: 13 subjects, the index and the version', () => {
    expect(Object.keys(built.files).sort()).toEqual(
      [
        ...DSKP_SUBJECTS.map((s) => `${OUTPUT_DIR}/${s.slug}.json`),
        `${OUTPUT_DIR}/index.json`,
        `${OUTPUT_DIR}/version.json`,
      ].sort(),
    )
  })

  it('reproduces every committed file exactly when re-run', () => {
    for (const [path, content] of Object.entries(built.files)) {
      expect(readRepo(path) === content, `${path} differs from the generator output`).toBe(true)
    }
  })

  it('is deterministic: two runs give identical output', () => {
    const again = buildDskp(readSourceFromRepo)
    expect(again.files).toEqual(built.files)
  })

  it('stamps version.json with the manual version and the hash of the committed data files', () => {
    const v = loadVersion()
    expect(v.version).toBe(DSKP_VERSION)
    const hash = createHash('sha256')
    for (const path of Object.keys(built.files).filter((p) => !p.endsWith('/version.json'))) {
      hash.update(`${path}\n${readRepo(path)}\n`)
    }
    expect(v.sha256).toBe(hash.digest('hex'))
  })

  it('writes minified JSON with a trailing newline', () => {
    for (const [path, content] of Object.entries(built.files)) {
      expect(content.endsWith('}\n') || content.endsWith(']\n'), path).toBe(true)
      expect(content.trimEnd().includes('\n'), path).toBe(false)
    }
  })
})

type Json = unknown

function strings(value: Json, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) for (const v of value) strings(v, out)
  else if (value && typeof value === 'object') for (const v of Object.values(value)) strings(v, out)
  return out
}

function obj(value: Json): Record<string, Json> {
  return (value ?? {}) as Record<string, Json>
}

/** Dropped fields that only repeat a kept field in another case; their text legitimately appears. */
const REPEATS_KEPT_FIELD = new Set(['titlePrinted', 'tajuk'])

/** Text of every field the extracts hold that the generator does not copy. */
function excludedText(): string[] {
  const out: string[] = []
  const take = (node: Json, spec: { dropped: readonly string[] }) => {
    for (const key of spec.dropped) {
      if (REPEATS_KEPT_FIELD.has(key)) continue
      const v = obj(node)[key]
      if (v !== undefined) strings(v, out)
    }
  }
  for (const cfg of DSKP_SUBJECTS) {
    const raw = readSourceFromRepo(cfg.slug)
    take(raw, FIELD_SPECS.file)
    const file = obj(raw)
    take(file['generalPerformanceLevels'], FIELD_SPECS.generalLevels)
    take(file['generalTP'], FIELD_SPECS.generalInterpretation)
    for (const unit of (file['units'] as Json[]) ?? []) {
      take(unit, FIELD_SPECS.unit)
      for (const tp of (obj(unit)['tahapPenguasaan'] as Json[]) ?? []) take(tp, FIELD_SPECS.tp)
      for (const std of (obj(unit)['standards'] as Json[]) ?? []) {
        take(std, FIELD_SPECS.standard)
        for (const tp of (obj(std)['tahapPenguasaan'] as Json[]) ?? []) take(tp, FIELD_SPECS.tp)
      }
    }
  }
  return out
}

/** Text of the fields the generator reads (the opposite of `excludedText`). */
function usedText(): Set<string> {
  const out: string[] = []
  const take = (node: Json, spec: { used: readonly string[] }) => {
    for (const key of spec.used) {
      const v = obj(node)[key]
      if (v !== undefined) strings(v, out)
    }
  }
  for (const cfg of DSKP_SUBJECTS) {
    take(readSourceFromRepo(cfg.slug), {
      used: FIELD_SPECS.file.used.filter((k) => k !== 'units'),
    })
    const file = obj(readSourceFromRepo(cfg.slug))
    for (const unit of (file['units'] as Json[]) ?? []) {
      take(unit, { used: FIELD_SPECS.unit.used.filter((k) => k !== 'standards') })
      for (const std of (obj(unit)['standards'] as Json[]) ?? []) {
        take(std, FIELD_SPECS.standard)
      }
    }
  }
  return new Set(out)
}

describe('DSKP generator field whitelist (DSKP-T01, NFR-07)', () => {
  const output = Object.values(built.files).join('\n')

  it('has a reviewed use-or-drop decision for every field of the 13 extracts', () => {
    // `pick` fails the build on an unreviewed field; reaching here means every field is decided.
    expect(Object.keys(built.files)).toHaveLength(15)
    const decided = (spec: { used: readonly string[]; dropped: readonly string[] }) =>
      new Set([...spec.used, ...spec.dropped])
    expect(decided(FIELD_SPECS.file).has('manualCorrections')).toBe(true)
    expect(FIELD_SPECS.file.used).not.toContain('source')
    expect(FIELD_SPECS.file.used).not.toContain('manualCorrections')
    expect(FIELD_SPECS.unit.used).not.toContain('note')
    expect(FIELD_SPECS.unit.used).not.toContain('moduleDescription')
  })

  it('copies no text from the whitelist-excluded fields into any data file', () => {
    const excluded = excludedText().filter((s) => s.length >= 20)
    expect(excluded.length).toBeGreaterThan(100)
    // A whole value is searched (quotes included): a copied field is copied whole, while a theme
    // name may sit inside a longer kept text. A string may legitimately be in both an excluded and a kept field (a theme name that is also
    // a group title); it only counts as leaked when the kept fields do not hold it.
    const kept = usedText()
    const leaked = [...new Set(excluded)].filter(
      (s) => !kept.has(s) && output.includes(JSON.stringify(s)),
    )
    expect(leaked).toEqual([])
  })

  it('writes only the documented keys', () => {
    const allowed = new Set([
      // subject files
      'code',
      'groups',
      'units',
      'generalTp',
      'tingkatan',
      'title',
      'group',
      'pkg',
      'flags',
      'tp',
      'sks',
      'sps',
      'text',
      'citizenship',
      'rows',
      'appliesToSk',
      'range',
      'label',
      // index
      'slug',
      'name',
      'language',
      'kind',
      'groupNoun',
      'unitNoun',
      'tpLevel',
      'rtlFields',
      'm03SubjectCode',
      'edition',
      'counts',
      'tingkatanFlags',
      'T4',
      'T5',
      'sk',
      'sp',
      'slots',
      // version
      'version',
      'sha256',
    ])
    const keysOf = (v: Json, out = new Set<string>()): Set<string> => {
      if (Array.isArray(v)) for (const x of v) keysOf(x, out)
      else if (v && typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) {
          out.add(k)
          keysOf(x, out)
        }
      }
      return out
    }
    for (const [path, content] of Object.entries(built.files)) {
      const stray = [...keysOf(JSON.parse(content))].filter((k) => !allowed.has(k))
      expect(stray, path).toEqual([])
    }
  })

  it('carries no personal name or honorific, and no panel or committee wording', () => {
    expect(output).not.toMatch(/\b(Encik|Puan|Cik|Dr\.|Prof\.|Datuk|Dato'|Tan Sri|Tuan|Tunku)\b/)
    // ("Jawatankuasa Hubungan Antara Kaum" in a Sejarah SP is curriculum content, not a panel.)
    expect(output).not.toMatch(
      /panel penggubal|ahli panel|penyelaras kurikulum|jawatankuasa (penggubal|kurikulum|pembangunan)|curriculum development committee/i,
    )
  })

  it('finds the two documented text defects with the defect scan, and no others', () => {
    expect(textDefects('sp', 'Menjelaskan punca berlakunya kemalangan dan')).toEqual(['truncated'])
    expect(textDefects('sk', 'Jg-1 OC-1x water mass(g) x water temperature(OCkJ)g-1')).toEqual([
      'garbled',
    ])
    expect(textDefects('sp', 'Explain linear magnification, m as:')).toEqual([])
    expect(textDefects('sk', 'Introduction to rate of reaction')).toEqual([])
    const flagged = built.report.subjects
      .flatMap((r) => r.flagged)
      .filter((f) => f.includes('textDefect'))
    expect(flagged.sort()).toEqual(['LNS:T4:sp:1.4.4 textDefect', 'SN:T5:sk:4.2 textDefect'])
  })

  it('fails the build on an unreviewed field, an unlisted defect and a changed slot', () => {
    const clone = (slug: string) => JSON.parse(JSON.stringify(readSourceFromRepo(slug))) as Json
    const read = (change: (slug: string, raw: Json) => void) => (slug: string) => {
      const raw = clone(slug)
      change(slug, raw)
      return raw
    }
    // A new panel-like field in a unit is neither used nor reviewed-and-dropped.
    expect(() =>
      buildDskp(
        read((slug, raw) => {
          if (slug === 'fizik')
            (obj(raw)['units'] as Json[]).forEach((u) => (obj(u)['panel'] = 'x'))
        }),
      ),
    ).toThrow(/neither whitelisted nor reviewed-and-dropped/)
    // A truncated SP that is not in the flag table.
    expect(() =>
      buildDskp(
        read((slug, raw) => {
          if (slug !== 'sejarah') return
          const unit = (obj(raw)['units'] as Json[])[0]
          const std = (obj(unit)['standards'] as Json[])[0]
          ;((obj(std)['sp'] as Json[])[0] as Record<string, Json>)['text'] =
            'Menerangkan peranan dan'
        }),
      ),
    ).toThrow(/defect scan/)
    // A "No learning standard" slot that the flag table does not know.
    expect(() =>
      buildDskp(
        read((slug, raw) => {
          if (slug !== 'bahasa-inggeris') return
          const unit = (obj(raw)['units'] as Json[])[0]
          const std = (obj(unit)['standards'] as Json[])[0]
          ;((obj(std)['sp'] as Json[])[0] as Record<string, Json>)['text'] = 'No learning standard'
        }),
      ),
    ).toThrow(/slots/)
  })
})
