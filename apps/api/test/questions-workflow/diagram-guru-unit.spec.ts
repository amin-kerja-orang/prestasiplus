import { describe, expect, it } from 'vitest'

import { diagramPayloadOf, diagramStimulusRef, diagramTargetOf, pendingQuestionIds, pickGroupStimulus, type DiagramTarget } from '../../src/modules/intake/files/guru-diagram'
import { payloadOf } from '../../src/modules/intake/workflow/item-model'

/** S6-T18 part 2: the pure parts of the teacher diagram upload (no database). */
const target: DiagramTarget = { kind: 'mcq', questionId: '41', groupId: '7', stimulusId: '9', imageFileId: '123' }

describe('diagram item payload', () => {
  it('is a valid stored item payload and carries the target', () => {
    const payload = diagramPayloadOf(target, 'Matematik')
    const stored = payloadOf({ payload })
    expect(stored.target).toEqual(target)
    expect(stored.tag.subject).toBe('Matematik')
    expect(diagramTargetOf(payload)).toEqual(target)
  })

  it('falls back to a subject code when the subject is unknown, and cuts a long one to 32', () => {
    expect(diagramPayloadOf(target, null).tag).toMatchObject({ subject: 'UMUM' })
    expect((diagramPayloadOf(target, 'x'.repeat(80)).tag as { subject: string }).subject).toHaveLength(32)
  })

  it('an item without a target, or with a malformed one, is not a diagram item', () => {
    expect(diagramTargetOf({ stem: 'x' })).toBeNull()
    expect(diagramTargetOf({ target: { ...target, extra: 1 } })).toBeNull()
    expect(diagramTargetOf({ target: { ...target, groupId: '' } })).toBeNull()
    expect(diagramTargetOf(null)).toBeNull()
  })

  it('names the batch stimulus after the group', () => {
    expect(diagramStimulusRef('7')).toBe('group:7')
  })
})

describe('the stimulus that receives the image', () => {
  const row = (id: bigint, kind: string, position: number, assetFileId: bigint | null = null) => ({ id, kind, position, assetFileId })
  it('is the first image-kind stimulus without a file, by position', () => {
    expect(pickGroupStimulus([row(1n, 'passage', 1), row(2n, 'diagram', 2)])?.id).toBe(2n)
    expect(pickGroupStimulus([row(3n, 'graph', 3), row(2n, 'map', 2)])?.id).toBe(2n)
    expect(pickGroupStimulus([row(1n, 'diagram', 1, 50n), row(2n, 'image', 2)])?.id).toBe(2n)
  })
  it('is none for a table-only, a passage-only or an image-with-file group, and for an empty one', () => {
    expect(pickGroupStimulus([row(1n, 'table', 1)])).toBeNull()
    expect(pickGroupStimulus([row(5n, 'passage', 2), row(4n, 'passage', 1)])).toBeNull()
    expect(pickGroupStimulus([row(1n, 'diagram', 1, 50n)])).toBeNull()
    expect(pickGroupStimulus([])).toBeNull()
  })
})

describe('pendingReview', () => {
  const asked = [{ id: '1', groupId: '7' }, { id: '2', groupId: '7' }, { id: '3', groupId: '8' }, { id: '4', groupId: null }]
  it('marks the questioned question and every question of its group', () => {
    expect([...pendingQuestionIds(asked, [{ questionId: '1', groupId: '7' }])].sort()).toEqual(['1', '2'])
  })
  it('marks a question with no group only by its own id, and nothing without open items', () => {
    expect([...pendingQuestionIds(asked, [{ questionId: '4', groupId: '99' }])]).toEqual(['4'])
    expect(pendingQuestionIds(asked, []).size).toBe(0)
  })
})
