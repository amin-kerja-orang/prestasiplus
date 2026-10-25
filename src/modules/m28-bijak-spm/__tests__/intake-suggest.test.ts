/**
 * DSKP-T06: the mock extractor suggests the DSKP tag from the catalogue (v2-dskp-integration 5.3).
 * A fixture catalogue (`createDskpCatalog`) makes the words, the scores and the ties exact; one smoke
 * test reads the real catalogue.
 */
import { afterEach, describe, expect, it } from 'vitest'

import { createDskpCatalog, dskpCatalog } from '@/modules/m03-curriculum'
import type { DskpSpNode, DskpSubjectData, DskpSubjectInfo } from '@/modules/m03-curriculum'

import { mockExtractor, parsePaper } from '../admin/intake/ai'
import {
  COMMAND_WORD_TP,
  GENERIC_NODE_LIMIT,
  HIGH_THRESHOLD,
  SUGGEST_THRESHOLD,
  confidenceFor,
  suggestTag,
  topicTokens,
  tpFromCommandWord,
} from '../admin/intake/ai/dskp-suggest'
import type { DskpView } from '../admin/intake/ai/dskp-suggest'
import { blankQuestion } from '../admin/intake/domain/blank'
import {
  pendingTagFields,
  suggestionLowFields,
  tagFieldResolved,
} from '../admin/intake/domain/suggestion'
import { fieldsToConfirm } from '../admin/intake/domain/validation'
import { SAMPLE_PAGES } from '../admin/intake/lib/sample-paper'
import type { IntakeQuestion } from '../admin/intake/types'
import { setDskpCatalogForTests } from '../lib/dskp-source'

const sp = (code: string, text: string) => ({ code, text })
const FIXTURE: DskpSubjectData = {
  code: 'MAT',
  groups: [],
  generalTp: null,
  units: [
    {
      tingkatan: 'T4',
      code: '1.0',
      title: 'Fungsi dan Persamaan Kuadratik',
      sks: [
        {
          code: '1.1',
          title: 'Persamaan kuadratik',
          sps: [
            sp('1.1.1', 'Mengenal pasti bentuk umum persamaan kuadratik'),
            sp('1.1.2', 'Menyelesaikan persamaan kuadratik menggunakan pemfaktoran'),
          ],
        },
      ],
    },
    {
      tingkatan: 'T4',
      code: '2.0',
      title: 'Indeks dan Logaritma',
      sks: [{ code: '2.1', title: 'Hukum indeks', sps: [sp('2.1.1', 'Memudahkan ungkapan menggunakan hukum indeks')] }],
    },
    {
      tingkatan: 'T4',
      code: '3.0',
      title: 'Garis Lurus',
      sks: [{ code: '3.1', title: 'Kecerunan', sps: [sp('3.1.1', 'Menentukan kecerunan garis lurus')] }],
    },
    {
      tingkatan: 'T5',
      code: '1.0',
      title: 'Garis Lurus Lanjutan',
      sks: [{ code: '1.1', title: 'Kecerunan', sps: [sp('1.1.1', 'Menentukan kecerunan garis lurus selari')] }],
    },
    {
      tingkatan: 'T5',
      code: '2.0',
      title: 'Kebarangkalian Peristiwa Bergabung',
      sks: [
        {
          code: '2.1',
          title: 'Peristiwa bergabung',
          sps: [sp('2.1.1', 'Menentukan kebarangkalian peristiwa bergabung')],
        },
      ],
    },
  ],
}
const INFO: DskpSubjectInfo = {
  ...(dskpCatalog.subject('MAT') as DskpSubjectInfo),
  counts: {
    T4: { units: 3, sk: 3, sp: 4, slots: 4 },
    T5: { units: 2, sk: 2, sp: 2, slots: 2 },
  },
}

function fixtureCatalogue(data: DskpSubjectData = FIXTURE) {
  return createDskpCatalog(
    { MAT: () => Promise.resolve(JSON.stringify(data)) },
    { version: 'dskp-fixture', subjects: [INFO] },
  )
}
async function fixtureView(): Promise<DskpView> {
  return fixtureCatalogue().load('MAT')
}

const paper = (body: string) => ({
  pages: [{ page: 1, source: 'text-layer' as const, text: body }],
  subject: 'MAT',
  kertas: 1 as const,
})
function extractOne(stem: string, view?: DskpView): IntakeQuestion {
  const out = parsePaper(paper(`1. ${stem} [2 markah]`), view ? { view, version: 'dskp-fixture' } : {})
  return out.questions[0]!
}

afterEach(() => setDskpCatalogForTests())

describe('topic words', () => {
  it('keeps distinct content words and drops short words, stop words and command words', () => {
    expect(topicTokens('Selesaikan persamaan kuadratik. Hitung persamaan itu, dan x di 2 jam')).toEqual([
      'persamaan',
      'kuadratik',
    ])
    expect(topicTokens('')).toEqual([])
  })

  it('normalises accents and case like the catalogue search', () => {
    expect(topicTokens('PERSAMAAN Kuadrátik')).toEqual(['persamaan', 'kuadratik'])
  })
})

describe('confidence mapping', () => {
  it('maps score and matched words to tinggi / sederhana / none', () => {
    expect(confidenceFor(1000, 4)).toBe('tinggi')
    expect(confidenceFor(HIGH_THRESHOLD, 3)).toBe('tinggi')
    expect(confidenceFor(HIGH_THRESHOLD - 1, 5)).toBe('sederhana')
    expect(confidenceFor(1000, 2)).toBe('sederhana') // a high score on two words is still only medium
    expect(confidenceFor(SUGGEST_THRESHOLD, 2)).toBe('sederhana')
    expect(confidenceFor(SUGGEST_THRESHOLD - 1, 4)).toBeNull()
    expect(confidenceFor(1000, 1)).toBeNull() // one word is never enough
  })

  it('tinggi for both unit and SP when both clear the high threshold', async () => {
    const q = extractOne('Selesaikan persamaan kuadratik menggunakan pemfaktoran.', await fixtureView())
    expect(q.tagSuggestion).toMatchObject({
      providerId: 'mock',
      unitId: 'MAT:T4:u:1.0',
      spIds: ['MAT:T4:sp:1.1.2'],
      formOrigin: 'T4',
      confidence: { unit: 'tinggi', sp: 'tinggi' },
    })
  })

  it('sederhana when the pair does not clear the high threshold', async () => {
    const q = extractOne('Nyatakan pemfaktoran bagi ungkapan kuadratik.', await fixtureView())
    expect(q.tagSuggestion).toMatchObject({
      unitId: 'MAT:T4:u:1.0',
      spIds: ['MAT:T4:sp:1.1.2'],
      confidence: { unit: 'sederhana', sp: 'sederhana' },
    })
  })

  it('suggests the unit alone when no SP text scores by itself (the unit is sederhana, never tinggi)', async () => {
    // "persamaan kuadratik" is in both SP of the unit: a tie, so no SP is guessed.
    const q = extractOne('Terangkan persamaan kuadratik dalam kehidupan.', await fixtureView())
    expect(q.tagSuggestion).toMatchObject({
      unitId: 'MAT:T4:u:1.0',
      confidence: { unit: 'sederhana' },
    })
    expect(q.tagSuggestion?.spIds).toBeUndefined()
    expect(q.tagSuggestion?.confidence.sp).toBeUndefined()
    expect(q.tag.spIds).toEqual([])
    // An incomplete tag (unit without SP): the unit must be confirmed by a person (lead decision).
    expect(q.lowFields).toEqual(['tag.unit', 'tag.tp']) // "Terangkan" also gives a TP suggestion
    expect(pendingTagFields(q)).toEqual(['unit', 'tp'])
  })

  it('a unit matched on too small a share of the question words is not suggested', async () => {
    const view = await fixtureView()
    // Five specific words, two of them in unit 1.0 (the best unit): 2/5 = 400 < 500.
    const low = suggestTag(
      { stem: 'persamaan kuadratik logaritma peristiwa kecerunan', partPrompts: [] },
      view,
      { providerId: 'mock', model: 'm' },
    )
    expect(low).toBeUndefined()
    // Six words, three in unit 1.0: exactly 500, the lowest score that is suggested.
    const edge = suggestTag(
      { stem: 'persamaan kuadratik pemfaktoran logaritma peristiwa kecerunan', partPrompts: [] },
      view,
      { providerId: 'mock', model: 'm' },
    )
    expect(edge).toMatchObject({ unitId: 'MAT:T4:u:1.0', confidence: { unit: 'sederhana' } })
  })
})

describe('evidence must be corroborated and measured against all topic words', () => {
  const opts = { providerId: 'mock', model: 'm' }

  it('two hits in different SPs out of ten topic words give no suggestion', async () => {
    const view = await fixtureView()
    // "bentuk" is only in SP 1.1.1 and "pemfaktoran" only in SP 1.1.2 (both of unit 1.0); the other
    // eight words hit nothing. No single SP holds two words, and 2/10 is below the threshold.
    const stem = 'bentuk pemfaktoran alpha bravo charlie delta foxtrot hotel india juliet'
    expect(topicTokens(stem)).toHaveLength(10)
    expect(suggestTag({ stem, partPrompts: [] }, view, opts)).toBeUndefined()
  })

  it('scattered words are no evidence even when they are all of the question', async () => {
    const view = await fixtureView()
    // Two words, both inside unit 1.0 but in different SPs: score 1000, still no corroboration.
    expect(suggestTag({ stem: 'bentuk pemfaktoran', partPrompts: [] }, view, opts)).toBeUndefined()
  })

  it('two words in one SP out of ten topic words are below the threshold', async () => {
    const view = await fixtureView()
    const stem = 'persamaan kuadratik alpha bravo charlie delta foxtrot hotel india juliet'
    expect(suggestTag({ stem, partPrompts: [] }, view, opts)).toBeUndefined()
  })

  it('zero-hit words count in the denominator', async () => {
    const view = await fixtureView()
    // The same two words in one SP: 2/3 = 667 with one filler word, 2/4 = 500 with two, 2/5 = 400 with three.
    const at = (filler: string) =>
      suggestTag({ stem: `persamaan kuadratik ${filler}`, partPrompts: [] }, view, opts)?.confidence.unit
    expect(at('alpha')).toBe('sederhana')
    expect(at('alpha bravo')).toBe('sederhana')
    expect(at('alpha bravo charlie')).toBeUndefined()
  })
})

describe('no auto-fill of an unmatched tag (AC-04.9)', () => {
  it('leaves unit, SP and tingkatan empty and marks tag.unit when nothing matches', async () => {
    const q = extractOne('Apakah warna langit pada waktu pagi?', await fixtureView())
    expect(q.tag).toMatchObject({ formOrigin: null, unitId: null, spIds: [], tp: null, catalogueVersion: null })
    expect(q.tagSuggestion).toBeUndefined()
    expect(q.lowFields).toContain('tag.unit')
  })

  it('does not guess from one matching word', async () => {
    const q = extractOne('Terangkan kecerunan.', await fixtureView())
    expect(q.tag.unitId).toBeNull()
    expect(q.lowFields).toContain('tag.unit')
  })

  it('does not guess between two units that match equally (ambiguous is no match)', async () => {
    // "kecerunan garis lurus" matches Garis Lurus (T4) and Garis Lurus Lanjutan (T5) alike.
    const q = extractOne('Tentukan kecerunan garis lurus itu.', await fixtureView())
    expect(q.tag.unitId).toBeNull()
    expect(q.tagSuggestion?.unitId).toBeUndefined()
    expect(q.lowFields).toContain('tag.unit')
  })

  it('the batch tingkatan, when declared, breaks that tie', async () => {
    const out = parsePaper(
      { ...paper('1. Tentukan kecerunan garis lurus itu. [2 markah]'), tingkatan: 'T5' },
      { view: await fixtureView(), version: 'v' },
    )
    expect(out.questions[0]!.tag).toMatchObject({ formOrigin: 'T5', unitId: 'MAT:T5:u:1.0' })
  })

  it('suggests nothing without a catalogue (unknown subject or a failed load)', () => {
    const q = extractOne('Selesaikan persamaan kuadratik menggunakan pemfaktoran.')
    expect(q.tag.unitId).toBeNull()
    expect(q.tag.spIds).toEqual([])
    expect(q.lowFields).toContain('tag.unit')
    expect(q.tag.tp).toBe(3) // the command word still gives a TP suggestion
  })

  it('a generic word (it starts too many nodes) is ignored', async () => {
    const many: DskpSubjectData = {
      ...FIXTURE,
      units: [
        ...FIXTURE.units,
        {
          tingkatan: 'T4',
          code: '9.0',
          title: 'Unit Murid',
          sks: [
            {
              code: '9.1',
              title: 'SK Murid',
              sps: [
                sp('9.1.0', 'Murid belajar pemfaktoran'),
                ...Array.from({ length: GENERIC_NODE_LIMIT }, (_, i) => sp(`9.1.${i + 1}`, `Murid belajar topik${i}`)),
              ],
            },
          ],
        },
      ],
    }
    const view = await fixtureCatalogue(many).load('MAT')
    const s = suggestTag({ stem: 'murid pemfaktoran', partPrompts: [] }, view, { providerId: 'mock', model: 'm' })
    // "murid" starts more than GENERIC_NODE_LIMIT nodes, so it is no evidence: were it counted, the
    // unit with the "Murid belajar pemfaktoran" SP would win with two words. One word is no match.
    expect(s).toBeUndefined()
  })

  it('only ever suggests a node that exists in the catalogue', async () => {
    const view = await fixtureView()
    for (const stem of [
      'Selesaikan persamaan kuadratik menggunakan pemfaktoran.',
      'Terangkan persamaan kuadratik dalam kehidupan.',
      'Apakah hukum indeks bagi logaritma?',
    ]) {
      const s = (extractOne(stem, view)).tagSuggestion
      if (s?.unitId) expect(view.unit(s.unitId)).toBeDefined()
      for (const id of s?.spIds ?? []) expect((view.sp(id) as DskpSpNode).unitId).toBe(s?.unitId)
    }
  })
})

describe('the tag is pre-filled from the suggestion', () => {
  it('fills tingkatan, unit, SP, version and TP; keeps the suggestion beside it', async () => {
    const q = extractOne('Hitung punca persamaan kuadratik menggunakan pemfaktoran.', await fixtureView())
    expect(q.tag).toMatchObject({
      subject: 'MAT',
      formOrigin: 'T4',
      unitId: 'MAT:T4:u:1.0',
      spIds: ['MAT:T4:sp:1.1.2'],
      tp: 3,
      kbat: null,
      catalogueVersion: 'dskp-fixture',
    })
    expect(q.tagSuggestion).toMatchObject({ tp: 3, unitId: q.tag.unitId, spIds: q.tag.spIds })
    expect(q.tagSuggestion?.model).toBe('heuristik-1')
  })

  it('the unit implies the tingkatan (a T5 unit gives T5)', async () => {
    const q = extractOne('Nyatakan kebarangkalian peristiwa bergabung.', await fixtureView())
    expect(q.tag).toMatchObject({ formOrigin: 'T5', unitId: 'MAT:T5:u:2.0' })
  })

  it('never suggests KBAT', async () => {
    const q = extractOne('Justifikasikan persamaan kuadratik menggunakan pemfaktoran.', await fixtureView())
    expect(q.tag.kbat).toBeNull()
    expect(q.tagSuggestion?.kbat).toBeUndefined()
    expect(q.tagSuggestion?.confidence.kbat).toBeUndefined()
    expect(q.lowFields).not.toContain('tag.kbat')
  })

  it('is deterministic', async () => {
    const view = await fixtureView()
    const a = (extractOne('Selesaikan persamaan kuadratik menggunakan pemfaktoran.', view)).tagSuggestion
    const b = (extractOne('Selesaikan persamaan kuadratik menggunakan pemfaktoran.', view)).tagSuggestion
    expect(a).toEqual(b)
  })

  it('uses the part prompts as well as the stem', async () => {
    const out = parsePaper(
      paper('1. Berdasarkan maklumat berikut,\n(a) selesaikan persamaan kuadratik menggunakan pemfaktoran. [2 markah]'),
      { view: await fixtureView(), version: 'v' },
    )
    expect(out.questions[0]!.tag.unitId).toBe('MAT:T4:u:1.0')
    expect(out.questions[0]!.tag.tp).toBe(3) // from the first part: the stem is a lead-in
  })
})

describe('command word to TP', () => {
  it('maps the documented table', () => {
    expect(COMMAND_WORD_TP).toEqual({
      nyatakan: 1,
      namakan: 1,
      terangkan: 2,
      jelaskan: 2,
      hitung: 3,
      selesaikan: 3,
      bandingkan: 4,
      analisis: 4,
      nilaikan: 5,
      justifikasikan: 5,
      reka: 6,
      cipta: 6,
    })
  })

  it('reads the leading word only, ignoring case and punctuation', () => {
    expect(tpFromCommandWord('  NYATAKAN satu ciri.', [])).toBe(1)
    expect(tpFromCommandWord('Bandingkan A dengan B', [])).toBe(4)
    expect(tpFromCommandWord('Berdasarkan Rajah 1, hitung luas.', [])).toBeNull()
    expect(tpFromCommandWord('Antara berikut, yang manakah?', [])).toBeNull()
  })

  it('falls back to the first part when the stem is a lead-in', () => {
    expect(tpFromCommandWord('Berdasarkan Rajah 1,', ['hitung panjang AC', 'nyatakan teorem'])).toBe(3)
    expect(tpFromCommandWord('', ['Reka satu eksperimen'])).toBe(6)
  })

  it('is always rendah and always in lowFields; no command word gives no TP', async () => {
    const view = await fixtureView()
    const withWord = extractOne('Nilaikan kesan hukum indeks terhadap logaritma.', view)
    expect(withWord.tag.tp).toBe(5)
    expect(withWord.tagSuggestion?.confidence.tp).toBe('rendah')
    expect(withWord.lowFields).toContain('tag.tp')

    const without = extractOne('Antara berikut, yang manakah benar?', view)
    expect(without.tag.tp).toBeNull()
    expect(without.tagSuggestion?.tp).toBeUndefined()
    expect(without.lowFields).not.toContain('tag.tp')
  })
})

describe('lowFields and confirmed', () => {
  it('starts with nothing confirmed', async () => {
    const q = extractOne('Hitung persamaan kuadratik menggunakan pemfaktoran.', await fixtureView())
    expect(q.confirmed).toEqual([])
  })

  it('a tinggi / sederhana unit and SP need no confirmation; the TP always does', async () => {
    const q = extractOne('Hitung persamaan kuadratik menggunakan pemfaktoran.', await fixtureView())
    expect(q.lowFields).toEqual(['tag.tp'])
    expect(fieldsToConfirm(q)).toEqual(['tag.tp'])
  })

  it('suggestionLowFields applies the rule for every field', () => {
    const base = { providerId: 'mock', model: 'm' }
    expect(suggestionLowFields(undefined)).toEqual(['tag.unit'])
    expect(suggestionLowFields({ ...base, confidence: {} })).toEqual(['tag.unit'])
    const unit = 'MAT:T4:u:1.0' as never
    const spIds = ['MAT:T4:sp:1.1.1' as never]
    expect(suggestionLowFields({ ...base, unitId: unit, spIds, confidence: { unit: 'tinggi', sp: 'tinggi' } })).toEqual([])
    // a unit without an SP is incomplete: the unit is confirmed by a person
    expect(suggestionLowFields({ ...base, unitId: unit, confidence: { unit: 'sederhana' } })).toEqual(['tag.unit'])
    expect(suggestionLowFields({ ...base, unitId: unit, spIds, confidence: { unit: 'rendah' } })).toEqual(['tag.unit'])
    expect(
      suggestionLowFields({ ...base, unitId: unit, spIds: ['MAT:T4:sp:1.1.1' as never], confidence: { unit: 'rendah', sp: 'rendah' } }),
    ).toEqual(['tag.unit', 'tag.sp'])
    expect(suggestionLowFields({ ...base, unitId: unit, spIds, tp: 2, confidence: { tp: 'tinggi' } })).toEqual(['tag.tp'])
    expect(suggestionLowFields({ ...base, unitId: unit, spIds, kbat: 'menilai', confidence: { kbat: 'tinggi' } })).toEqual(['tag.kbat'])
  })

  it('a field is resolved when ticked or changed away from the suggestion', async () => {
    const q = extractOne('Hitung persamaan kuadratik menggunakan pemfaktoran.', await fixtureView())
    expect(pendingTagFields(q)).toEqual(['tp'])
    expect(tagFieldResolved({ ...q, confirmed: ['tag.tp'] }, 'tp')).toBe(true)
    expect(tagFieldResolved({ ...q, tag: { ...q.tag, tp: 4 } }, 'tp')).toBe(true)
    // changing it back to the AI value makes it pending again
    expect(pendingTagFields({ ...q, tag: { ...q.tag, tp: 4 } })).toEqual([])
    expect(pendingTagFields({ ...q, tag: { ...q.tag, tp: 3 } })).toEqual(['tp'])
  })

  it('an unmatched unit is resolved once a person picks one', async () => {
    const q = extractOne('Apakah warna langit?', await fixtureView())
    expect(pendingTagFields(q)).toEqual(['unit'])
    expect(pendingTagFields({ ...q, tag: { ...q.tag, unitId: 'MAT:T4:u:2.0' as never } })).toEqual([])
  })

  it('a manual blank question carries no suggestion and nothing to confirm', () => {
    const q = blankQuestion('MAT', 1)
    expect(q.tagSuggestion).toBeUndefined()
    expect(q.lowFields).toEqual([])
    expect(q.confirmed).toEqual([])
    expect(q.tag).toMatchObject({ formOrigin: null, unitId: null, spIds: [], tp: null, kbat: null })
  })
})

describe('extract() loads the catalogue once', () => {
  it('uses the catalogue m28 reads and loads the batch subject a single time', async () => {
    let loads = 0
    setDskpCatalogForTests(
      createDskpCatalog(
        {
          MAT: () => {
            loads++
            return Promise.resolve(JSON.stringify(FIXTURE))
          },
        },
        { version: 'dskp-fixture', subjects: [INFO] },
      ),
    )
    const body = '1. Selesaikan persamaan kuadratik menggunakan pemfaktoran. [2 markah]\n2. Nyatakan hukum indeks bagi logaritma. [1 markah]'
    const r = await mockExtractor.extract(paper(body))
    expect(loads).toBe(1)
    expect(r.questions[0]!.tag).toMatchObject({ unitId: 'MAT:T4:u:1.0', catalogueVersion: 'dskp-fixture' })
    expect(r.questions[1]!.tag.unitId).toBe('MAT:T4:u:2.0')
    expect(r.warnings).toEqual([])
  })

  it('a failing chunk costs only the suggestion: a warning, an empty tag, tag.unit marked', async () => {
    setDskpCatalogForTests(
      createDskpCatalog(
        { MAT: () => Promise.reject(new Error('offline')) },
        { version: 'v', subjects: [INFO] },
      ),
    )
    const r = await mockExtractor.extract(paper('1. Selesaikan persamaan kuadratik menggunakan pemfaktoran. [2 markah]'))
    expect(r.questions[0]!.tag.unitId).toBeNull()
    expect(r.questions[0]!.lowFields).toContain('tag.unit')
    expect(r.warnings.join(' ')).toContain('Katalog DSKP')
  })

  it('a subject outside the catalogue gives no warning and no unit', async () => {
    const r = await mockExtractor.extract({ ...paper('1. Nyatakan satu fakta. [1 markah]'), subject: 'XX' })
    expect(r.questions[0]!.tag.unitId).toBeNull()
    expect(r.warnings.join(' ')).not.toContain('Katalog DSKP')
  })
})

describe('real catalogue smoke test', () => {
  it('the sample paper gets a TP from the command word and no unit it cannot back up', async () => {
    const r = await mockExtractor.extract({ pages: SAMPLE_PAGES, subject: 'MAT', kertas: 2 })
    // Q3 ("hitung panjang AC", "hitung luas segi tiga") used to be tagged T5 unit 5.0 from words
    // scattered over unrelated SPs; it must now be left empty for a person.
    expect(
      r.questions.map((q) => ({
        label: q.label,
        formOrigin: q.tag.formOrigin,
        unitId: q.tag.unitId,
        spIds: q.tag.spIds,
        tp: q.tag.tp,
        lowFields: q.lowFields,
      })),
    ).toEqual([
      { label: '1', formOrigin: null, unitId: null, spIds: [], tp: 3, lowFields: ['tag.unit', 'tag.tp'] },
      { label: '2', formOrigin: null, unitId: null, spIds: [], tp: null, lowFields: ['tag.unit'] },
      { label: '3', formOrigin: null, unitId: null, spIds: [], tp: 3, lowFields: ['tag.unit', 'tag.tp'] },
      { label: '4', formOrigin: null, unitId: null, spIds: [], tp: 1, lowFields: ['tag.unit', 'tag.tp'] },
      { label: '5', formOrigin: null, unitId: null, spIds: [], tp: 1, lowFields: ['tag.unit', 'tag.tp'] },
    ])
  })

  it('whatever it does suggest on the real catalogue is a node of the subject', async () => {
    const view = await dskpCatalog.load('MAT')
    const out = parsePaper(
      paper('1. Selesaikan persamaan kuadratik dalam satu pemboleh ubah. [2 markah]'),
      { view, version: dskpCatalog.version },
    )
    const q = out.questions[0]!
    expect(q.tag.unitId).toBe('MAT:T4:u:1.0')
    expect(view.unit(q.tag.unitId!)?.tingkatan).toBe('T4')
    for (const id of q.tag.spIds) expect(view.sp(id)?.unitId).toBe(q.tag.unitId)
    expect(q.tag.catalogueVersion).toBe(dskpCatalog.version)
  })
})
