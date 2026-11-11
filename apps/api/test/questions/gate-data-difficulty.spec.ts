import { describe, expect, it } from 'vitest'

import { maskCarriedPrompts } from '../../src/modules/questions/carried-prompt'
import { gateDataOf, type GateVersion } from '../../src/modules/questions/gate-data'
import type { GateFacts } from '../../src/modules/questions/types'

const facts = { unconfirmedLowConfidenceFields: [], hasOpenDuplicateFlag: false, mediaResolved: true, lastEditedByAi: false, declaredMarks: null, hasDskpNodes: false, hasChapters: false, spOutsideUnit: [] } as unknown as GateFacts
const version = (o: Partial<Record<string, unknown>>): GateVersion =>
  ({ stemMs: 'Terangkan proses fotosintesis.', parts: [], subjectId: '3', educationLevelId: '7', chapterId: null, unitId: null, spIds: [], difficultyTp: null, difficultyLevel: null, paperCode: null, ...o }) as unknown as GateVersion

/** K10: the gate judges the level the Studio shows (DM-47 read rule), so a migrated essay with no typed level can be submitted. */
describe('gateDataOf difficultyLevel', () => {
  it('reads the typed level first', () => {
    expect(gateDataOf({ id: '1', version: version({ difficultyLevel: 2, difficultyTp: 5 }) }, facts, true).difficultyLevel).toBe(2)
  })
  it('falls back to least(5, TP), then to 3, as the read view does', () => {
    expect(gateDataOf({ id: '1', version: version({ difficultyTp: 6 }) }, facts, true).difficultyLevel).toBe(5)
    expect(gateDataOf({ id: '1', version: version({}) }, facts, true).difficultyLevel).toBe(3)
  })
})

describe('maskCarriedPrompts', () => {
  it('lets a NEW part keep an empty instruction (V2 prompt_text is nullable) and puts it back after parsing', () => {
    const { masked, restore } = maskCarriedPrompts([{ label: 'a', prompt: { ms: '' } }], undefined)
    expect(masked[0]?.prompt?.ms).toBe('-')
    expect(restore(masked)[0]?.prompt?.ms).toBe('')
  })
  it('leaves a typed instruction alone', () => {
    const { masked } = maskCarriedPrompts([{ label: 'a', prompt: { ms: 'Pilih.' } }], undefined)
    expect(masked[0]?.prompt?.ms).toBe('Pilih.')
  })
})
