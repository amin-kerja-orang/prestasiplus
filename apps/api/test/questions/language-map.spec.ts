import { describe, expect, it } from 'vitest'

import { bilingualScriptConflict, flatFromVersion, flatLanguageOf, languageToStore, scriptOf } from '../../src/modules/questions/projection'
import type { QuestionVersionRecord } from '../../src/modules/questions/types'

/**
 * S1-T09b part A, 60 API-Q-03 and 45 section 2.7 [CI]: the wire language tokens `ms`, `en`, `ms+en` (and `bm`, an input alias of `ms`)
 * against the stored `ms`, `en`, `ms_en`, `ar`, `jawi`. No database.
 */
describe('language map wire to store', () => {
  it.each([
    [undefined, 'ms'],
    ['ms', 'ms'],
    ['bm', 'ms'],
    ['en', 'en'],
    ['ms+en', 'ms_en'],
  ] as const)('%s is stored as %s', (wire, stored) => {
    expect(languageToStore(wire, undefined)).toBe(stored)
    expect(languageToStore(wire, 'rumi')).toBe(stored)
  })

  it('the script wins over the language for jawi, arab and mixed', () => {
    expect(languageToStore('en', 'jawi')).toBe('jawi')
    expect(languageToStore('ms', 'arab')).toBe('ar')
    expect(languageToStore(undefined, 'mixed')).toBe('ms_en')
  })

  it('a bilingual request in Jawi or Arab is a conflict (known R1 limit); Rumi, mixed and monolingual are not', () => {
    expect(bilingualScriptConflict('ms+en', 'jawi')).toBe(true)
    expect(bilingualScriptConflict('ms+en', 'arab')).toBe(true)
    expect(bilingualScriptConflict('ms+en', 'ar')).toBe(true)
    expect(bilingualScriptConflict('ms+en', 'rumi')).toBe(false)
    expect(bilingualScriptConflict('ms+en', 'ms_en')).toBe(false)
    expect(bilingualScriptConflict('ms+en', undefined)).toBe(false)
    expect(bilingualScriptConflict('ms', 'jawi')).toBe(false)
    expect(bilingualScriptConflict('bm', 'ar')).toBe(false)
    expect(bilingualScriptConflict(undefined, 'jawi')).toBe(false)
  })
})

describe('language map store to wire', () => {
  it.each([
    ['ms', 'ms'],
    ['en', 'en'],
    ['ms_en', 'ms+en'],
    ['jawi', 'ms'],
    ['ar', 'ms'],
  ] as const)('stored %s reads as %s and never as bm', (stored, wire) => {
    expect(flatLanguageOf(stored)).toBe(wire)
  })

  it('a stored ms_en still reads as script mixed, and a round trip through the map keeps it', () => {
    expect(scriptOf('ms_en')).toBe('mixed')
    expect(languageToStore(flatLanguageOf('ms_en'), undefined)).toBe('ms_en')
    expect(languageToStore(flatLanguageOf('en'), undefined)).toBe('en')
    expect(languageToStore(flatLanguageOf('ms'), undefined)).toBe('ms')
  })

  it('the flat fields carry the language token and the English stem', () => {
    const v = {
      stemMs: 'Soalan dalam Bahasa Melayu.',
      stemEn: 'The question in English.',
      explanationMs: null,
      language: 'ms_en',
      difficultyTp: 3,
      difficultyLevel: 3,
      parts: [],
    } as unknown as QuestionVersionRecord
    const flat = flatFromVersion(v)
    expect(flat.language).toBe('ms+en')
    expect(flat.questionTextEn).toBe('The question in English.')
    expect(flatFromVersion({ ...v, stemEn: null, language: 'ms' } as QuestionVersionRecord)).toMatchObject({ language: 'ms', questionTextEn: null })
  })
})
