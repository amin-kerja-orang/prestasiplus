import { describe, expect, it } from 'vitest'

import { figureKeys, linkReferencingItems, stimulusKey } from '../../src/modules/intake/workflow/figure-links'

describe('figure references (D90)', () => {
  it('reads BM and English figure words and numbers into one key', () => {
    expect(figureKeys('Berdasarkan Rajah 1, hitung luas.')).toEqual(['rajah1'])
    expect(figureKeys('rajah2 dan Rajah 1 serta rajah 2')).toEqual(['rajah2', 'rajah1'])
    expect(figureKeys('Gambar rajah 3 menunjukkan litar. Lihat Figure 3.')).toEqual(['rajah3'])
    expect(figureKeys('Jadual 2 / Table 2 / Graf 1 / Petikan 4')).toEqual(['jadual2', 'graf1', 'petikan4'])
    expect(figureKeys('Rajah 2.1 dan Rajah 21')).toEqual(['rajah2.1', 'rajah21'])
  })

  it('does not read a number that belongs to another word or has no number at all', () => {
    expect(figureKeys('Rajah di atas. Diagrams1')).toEqual([])
    expect(figureKeys('Nilai x2 dalam jadual itu')).toEqual([])
    expect(stimulusKey('Petikan A')).toBeNull()
  })

  it('links EVERY unlinked item that names the figure to the one stimulus, and leaves the rest alone', () => {
    const stimuli = [
      { ref: 'stim-1', label: 'Rajah 1' },
      { ref: 'stim-2', label: 'Jadual 1' },
    ]
    const items = [
      { index: 0, stimulusRef: 'stim-1', text: 'S1 berdasarkan Rajah 1' },
      { index: 1, stimulusRef: null, text: 'S2 Rajah 1 juga menunjukkan' },
      { index: 2, stimulusRef: null, text: 'S3 tiada rujukan' },
      { index: 3, stimulusRef: null, text: 'S4 lihat Jadual 1' },
      { index: 4, stimulusRef: 'stim-2', text: 'S5 mengenai Rajah 1 tetapi sudah dipautkan' },
      { index: 5, stimulusRef: null, text: 'S6 Rajah 1 dan Jadual 1' },
    ]
    const { links, several } = linkReferencingItems(stimuli, items)
    expect([...links.entries()]).toEqual([[1, 'stim-1'], [3, 'stim-2'], [5, 'stim-1']])
    expect(several).toEqual([5])
  })

  it('a figure listed twice is one: the first copy wins so the items never split', () => {
    const { links } = linkReferencingItems(
      [{ ref: 'a', label: 'Rajah 1' }, { ref: 'b', label: 'rajah 1' }],
      [{ index: 0, stimulusRef: null, text: 'Rajah 1' }, { index: 1, stimulusRef: null, text: 'Rajah 1' }],
    )
    expect([...links.values()]).toEqual(['a', 'a'])
  })
})
