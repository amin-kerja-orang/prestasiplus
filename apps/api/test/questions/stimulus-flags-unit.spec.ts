import { describe, expect, it } from 'vitest'

import { stimulusReferenceOf } from '../../src/modules/intake/workflow/figure-links'
import { detectStimulusFlag, type FlagInput, type FlagPart } from '../../src/modules/questions/effective-leaf'

/**
 * S1-T07 (DM-05, DM-53): the three stimulus-flag detectors on real-looking stems. Pure: no database.
 */
const leaf = (over: Partial<FlagPart> = {}): FlagPart => ({
  isLeaf: true,
  promptMs: '',
  promptEn: null,
  optionTexts: ['Satu', 'Dua', 'Tiga', 'Empat'],
  hasStimulus: false,
  hasOptionImage: false,
  ...over,
})
const input = (over: Partial<FlagInput> = {}): FlagInput => ({ stemMs: null, stemEn: null, hasGroup: false, hasStemStimulus: false, parts: [leaf()], ...over })

describe('stimulus_missing', () => {
  it('[CI] "Rajah 14 menunjukkan ..." with no figure is stimulus_missing, numbered', () => {
    const r = detectStimulusFlag(input({ stemMs: 'Rajah 14 menunjukkan satu litar sesiri. Hitung rintangan berkesan litar itu.' }))
    expect(r).toEqual({ flag: 'stimulus_missing', ref: 'numbered' })
  })

  it('[CI] the reference words of the card match case-insensitively, as whole words', () => {
    for (const stem of ['Berdasarkan JADUAL 2, hitung min.', 'Berdasarkan peta 2, nyatakan lokasi X.', 'Carta 1 menunjukkan jualan.', 'Petikan 3 di atas ialah sebuah cerpen.']) {
      expect(detectStimulusFlag(input({ stemMs: stem }))?.flag, stem).toBe('stimulus_missing')
    }
  })

  it('[CI] "Graf" as a whole word without a number is stimulus_missing, unnumbered', () => {
    expect(detectStimulusFlag(input({ stemMs: 'Graf di atas menunjukkan hubungan antara halaju dan masa.' }))).toEqual({ flag: 'stimulus_missing', ref: 'unnumbered' })
    expect(detectStimulusFlag(input({ stemMs: 'Graf' }))).toEqual({ flag: 'stimulus_missing', ref: 'unnumbered' })
    expect(detectStimulusFlag(input({ stemMs: 'Lihat petikan berikut.' }))).toEqual({ flag: 'stimulus_missing', ref: 'unnumbered' })
  })

  it('[CI] "Rajahnya" and other words that only contain a keyword do NOT match', () => {
    for (const stem of ['Rajahnya cantik dan kemas.', 'Petakan jawapan anda pada kertas lukisan.', 'Kartografi ialah sains membuat atlas.', 'Jadualkan kerja anda mengikut keutamaan.', 'Pengrajah kuasa dua nombor itu.']) {
      expect(detectStimulusFlag(input({ stemMs: stem })), stem).toBeNull()
    }
    expect(stimulusReferenceOf('Rajahnya cantik')).toBeNull()
    expect(stimulusReferenceOf('rajah14')).toEqual({ kind: 'numbered', text: 'rajah14' })
  })

  it('[CI] the numbered form wins when a text has both', () => {
    expect(stimulusReferenceOf('Graf dan Rajah 3')).toEqual({ kind: 'numbered', text: 'Rajah 3' })
  })

  it('[CI] the part prompts and the options are examined too', () => {
    expect(detectStimulusFlag(input({ stemMs: 'Hitung nilai x.', parts: [leaf({ promptMs: 'Merujuk Jadual 1, pilih jawapan.' })] }))?.flag).toBe('stimulus_missing')
    expect(detectStimulusFlag(input({ stemMs: 'Hitung nilai x.', parts: [leaf({ optionTexts: ['Rajah 2', 'B', 'C', 'D'] })] }))?.flag).toBe('stimulus_missing')
    expect(detectStimulusFlag(input({ stemEn: 'Based on Figure 3, find the area.' }))).toEqual({ flag: 'stimulus_missing', ref: 'numbered' })
  })

  it('[CI] a group, a stimulus, a part stimulus or an option picture clears it (no flag when something is attached)', () => {
    const stem = 'Rajah 14 menunjukkan satu litar sesiri.'
    expect(detectStimulusFlag(input({ stemMs: stem, hasGroup: true }))).toBeNull()
    expect(detectStimulusFlag(input({ stemMs: stem, hasStemStimulus: true }))).toBeNull()
    expect(detectStimulusFlag(input({ stemMs: stem, parts: [leaf({ hasStimulus: true })] }))).toBeNull()
    expect(detectStimulusFlag(input({ stemMs: stem, parts: [leaf({ hasOptionImage: true })] }))).toBeNull()
  })

  it('[CI] a stem that names no figure has no flag', () => {
    expect(detectStimulusFlag(input({ stemMs: 'Apakah hasil tambah 3 dan 4?' }))).toBeNull()
  })
})

describe('figure_only', () => {
  it('[CI] an image on the stem, empty stem, no prompt text and no options is figure_only', () => {
    expect(detectStimulusFlag(input({ stemMs: '   ', hasStemStimulus: true, parts: [leaf({ promptMs: '', optionTexts: [] })] }))).toEqual({ flag: 'figure_only', ref: null })
    expect(detectStimulusFlag(input({ stemMs: null, hasStemStimulus: true, parts: [] }))).toEqual({ flag: 'figure_only', ref: null })
  })

  it('[CI] a stem sentence, a prompt, an option or a group makes it a normal question', () => {
    expect(detectStimulusFlag(input({ stemMs: 'Hitung luas rajah itu.', hasStemStimulus: true, parts: [leaf({ optionTexts: [] })] }))).toBeNull()
    expect(detectStimulusFlag(input({ stemMs: '', hasStemStimulus: true, parts: [leaf({ promptMs: 'Hitung luas.', optionTexts: [] })] }))).toBeNull()
    expect(detectStimulusFlag(input({ stemMs: '', hasStemStimulus: true, parts: [leaf({ optionTexts: ['A', 'B'] })] }))).toBeNull()
    expect(detectStimulusFlag(input({ stemMs: '', hasStemStimulus: true, hasGroup: true, parts: [] }))).toBeNull()
  })

  it('[CI] an empty stem with no image is not figure_only', () => {
    expect(detectStimulusFlag(input({ stemMs: '', hasStemStimulus: false, parts: [] }))).toBeNull()
  })
})

describe('stem_duplicated', () => {
  const same = 'Yang manakah antara berikut ialah nombor perdana?'
  it('[CI] the stem equals the prompt of its only leaf after trimming and collapsing spaces', () => {
    expect(detectStimulusFlag(input({ stemMs: same, parts: [leaf({ promptMs: same })] }))).toEqual({ flag: 'stem_duplicated', ref: null })
    expect(detectStimulusFlag(input({ stemMs: `  ${same}  `, parts: [leaf({ promptMs: same.replace(' ', '   ') })] }))?.flag).toBe('stem_duplicated')
  })

  it('[CI] two leaves, a different prompt or an empty prompt is not a duplicate', () => {
    expect(detectStimulusFlag(input({ stemMs: same, parts: [leaf({ promptMs: same }), leaf({ promptMs: 'lain' })] }))).toBeNull()
    expect(detectStimulusFlag(input({ stemMs: same, parts: [leaf({ promptMs: 'Soalan lain.' })] }))).toBeNull()
    expect(detectStimulusFlag(input({ stemMs: '', parts: [leaf({ promptMs: '' })] }))).toBeNull()
  })

  it('[CI] a branch part does not count as a leaf', () => {
    expect(detectStimulusFlag(input({ stemMs: same, parts: [leaf({ isLeaf: false, promptMs: same }), leaf({ promptMs: 'Bahagian (a)' })] }))).toBeNull()
  })

  it('[CI] stimulus_missing wins over stem_duplicated (the excluding flag is the one stored)', () => {
    const stem = 'Rajah 14 menunjukkan satu litar.'
    expect(detectStimulusFlag(input({ stemMs: stem, parts: [leaf({ promptMs: stem })] }))?.flag).toBe('stimulus_missing')
  })
})
