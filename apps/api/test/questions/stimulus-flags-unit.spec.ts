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
    expect(detectStimulusFlag(input({ stemMs: 'Graf' }))).toBeNull()
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
    expect(detectStimulusFlag(input({ stemEn: 'Based on Jadual 3, find the area.' }))).toEqual({ flag: 'stimulus_missing', ref: 'numbered' })
    expect(detectStimulusFlag(input({ stemEn: 'Based on Figure 3, find the area of the Table 2.' }))).toEqual({ flag: 'stimulus_missing', ref: 'numbered' })
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

/**
 * PO decision 2026-11-05: the ONE canonical rule is 45 section 6.6.1 (supersedes the D115 default). The former D115 false positives are
 * not flagged now: a bare word alone is no reference.
 */
describe('45 6.6.1 keyword rule', () => {
  it('[CI] "berkongsi petikan" and "Rajah kuasa tiga" are NOT flagged (a bare word alone)', () => {
    for (const stem of ['Murid berkongsi petikan akhbar tentang alam sekitar. Apakah tujuannya?', 'Rajah kuasa tiga bagi 2 ialah 8. Nyatakan nilai 3 kuasa tiga.']) {
      expect(detectStimulusFlag(input({ stemMs: stem })), stem).toBeNull()
    }
  })

  it('[CI] numbered form: a BM word and an English word followed by a number', () => {
    expect(stimulusReferenceOf('Berdasarkan Jadual 2.1, hitung min.')).toEqual({ kind: 'numbered', text: 'Jadual 2.1' })
    expect(stimulusReferenceOf('Gambar rajah 4 menunjukkan satu litar.')).toEqual({ kind: 'numbered', text: 'Gambar rajah 4' })
    expect(stimulusReferenceOf('Study Figure 4 and answer.')).toEqual({ kind: 'numbered', text: 'Figure 4' })
    expect(detectStimulusFlag(input({ stemEn: 'The Graph 2 shows the speed.' }))).toEqual({ flag: 'stimulus_missing', ref: 'numbered' })
  })

  it('[CI] numbered form is for figure words only: a source word plus a number is not numbered', () => {
    expect(stimulusReferenceOf('Teks 2 ialah satu cerpen.')).toBeNull()
  })

  it('[CI] unnumbered form: a figure or source word with a positional phrase within 3 words (before or after)', () => {
    expect(stimulusReferenceOf('Rajah di atas menunjukkan satu litar.')).toEqual({ kind: 'unnumbered', text: 'Rajah' })
    expect(stimulusReferenceOf('Maklumat di bawah ialah tentang sebuah kilang.')?.kind).toBe('unnumbered')
    expect(stimulusReferenceOf('Berdasarkan petikan di atas, apakah tema cerita?')?.kind).toBe('unnumbered')
    expect(stimulusReferenceOf('Read the passage below and answer.')?.kind).toBe('unnumbered')
    expect(stimulusReferenceOf('Lihat sumber berikut.')?.kind).toBe('unnumbered')
    expect(stimulusReferenceOf('Using the following text, find the theme.')?.kind).toBe('unnumbered')
    // Four words away is too far; a sentence end is a barrier.
    expect(stimulusReferenceOf('Graf itu sangat besar dan jelas di atas meja.')).toBeNull()
    expect(stimulusReferenceOf('Lihat graf. Di bawah ialah jawapan.')).toBeNull()
  })

  it('[CI] subject of menunjukkan / shows', () => {
    expect(stimulusReferenceOf('Graf halaju-masa menunjukkan gerakan sebuah kereta.')?.kind).toBe('unnumbered')
    expect(stimulusReferenceOf('The chart shows the sales of a shop.')?.kind).toBe('unnumbered')
    expect(stimulusReferenceOf('Situasi menunjukkan pelbagai kemungkinan.')?.kind).toBe('unnumbered')
    expect(stimulusReferenceOf('Murid menunjukkan peta kepada guru dengan bangga sekali.')).toBeNull()
  })

  it('[CI] a source word: "Sumber"/"Teks" with a positional phrase flags, alone does not', () => {
    expect(detectStimulusFlag(input({ stemMs: 'Teks di atas ialah petikan novel. Siapakah watak utama?' }))).toEqual({ flag: 'stimulus_missing', ref: 'unnumbered' })
    expect(detectStimulusFlag(input({ stemMs: 'Teks ucapan itu dibacakan oleh murid.' }))).toBeNull()
    expect(detectStimulusFlag(input({ stemMs: 'Sumber air bersih amat penting.' }))).toBeNull()
  })

  it('[CI] matching is case-insensitive and diacritic / whitespace normalised', () => {
    expect(stimulusReferenceOf('RAJAH   DI   ATAS menunjukkan')?.kind).toBe('unnumbered')
    expect(stimulusReferenceOf('Le diagram ci-dessus, Figure\u00a05')?.kind).toBe('numbered')
    expect(stimulusReferenceOf('Rajah\u0301 di atas')?.kind).toBe('unnumbered')
  })

  it('[CI] a group, a stimulus or an image still clears the flag', () => {
    expect(detectStimulusFlag(input({ stemMs: 'Rajah di atas menunjukkan satu litar.', hasGroup: true }))).toBeNull()
    expect(detectStimulusFlag(input({ stemMs: 'Rajah di atas menunjukkan satu litar.', hasStemStimulus: true }))?.flag).not.toBe('stimulus_missing')
  })
})
