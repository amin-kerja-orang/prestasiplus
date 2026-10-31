import type { StudioGroup } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { blankDraft } from '../../../lib/studio/draft'
import { previewItems, toStimulusData } from '../../../lib/studio/preview'

const group: StudioGroup = {
  id: '9', label: 'Rajah 1',
  stimuli: [{ id: '70', kind: 'diagram', label: 'Rajah 1', caption: 'Segi tiga', alt: 'Segi tiga bersudut tegak', body: null, table: null, sourceCitation: null, imageId: 'abcdefghijklmnopqrstuv' }],
  members: [
    { id: '501', position: 1, numberLabel: '1', stem: 'S1 Rajah 1', status: 'draft' },
    { id: '502', position: 2, numberLabel: '2', stem: 'S2 Rajah 1', status: 'draft' },
  ],
  memberCount: 2, complete: true, locked: false, issues: [],
}

describe('Pratonton (D90)', () => {
  it('maps a Studio stimulus to the shared display data', () => {
    expect(toStimulusData(group.stimuli[0]!)).toEqual({ id: '70', kind: 'diagram', label: 'Rajah 1', caption: 'Segi tiga', alt: 'Segi tiga bersudut tegak', src: '/api/files/abcdefghijklmnopqrstuv' })
    const t = toStimulusData({ ...group.stimuli[0]!, imageId: null, table: { head: ['a'], rows: [['1']] }, body: 'Teks' })
    expect(t).toMatchObject({ text: 'Teks', table: { head: ['a'], rows: [['1']] } })
    expect('src' in t).toBe(false)
  })

  it('lists every member once, in group order, with the edited question showing its unsaved text', () => {
    const d = blankDraft()
    d.stem = 'S2 disunting'
    d.leaves[0]!.prompt = 'Pilih'
    d.leaves[0]!.options[0]!.text = 'Satu'
    const items = previewItems(group, d, '502')
    expect(items.map((i) => [i.id, i.label, i.stem, i.current])).toEqual([['501', '1', 'S1 Rajah 1', false], ['502', '2', 'S2 disunting', true]])
    expect(items[1]!.leaves[0]!.options[0]).toEqual({ letter: 'A', text: 'Satu' })
  })

  it('puts a question not yet in the group last, and a question without a group alone', () => {
    const d = blankDraft()
    d.stem = 'Baharu'
    expect(previewItems(group, d, null).map((i) => i.id)).toEqual(['501', '502', 'baharu'])
    expect(previewItems(null, d, null)).toHaveLength(1)
  })
})
