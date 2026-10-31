import { describe, expect, it } from 'vitest'

import { blankDraft } from '../../../lib/studio/draft'
import { clearSnapshot, loadSnapshot, parseSnapshot, recoveryKey, sameDraft, saveSnapshot, type KeyValueStore } from '../../../lib/studio/recovery'

function memory(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) }
}
const filled = () => {
  const d = blankDraft()
  d.subjectId = '3'
  d.stem = 'Berdasarkan Rajah 1, apakah ini?'
  d.spIds = ['41']
  d.groupId = '9'
  d.leaves[0]!.prompt = 'Pilih.'
  d.leaves[0]!.tp = 2
  d.leaves[0]!.cognitive = 'menilai'
  d.leaves[0]!.options[0]!.imageToken = 'tokenAbc'
  return d
}

describe('Studio draft recovery (V2 flow 1 step 2)', () => {
  it('keys a new question and each saved question apart', () => {
    expect(recoveryKey()).not.toBe(recoveryKey('5'))
    expect(recoveryKey('5')).not.toBe(recoveryKey('6'))
  })

  it('round-trips the draft and compares by content, not by row key', () => {
    const store = memory()
    const d = filled()
    saveSnapshot(store, recoveryKey(), d)
    const back = loadSnapshot(store, recoveryKey())
    expect(back).not.toBeNull()
    expect(sameDraft(back!, d)).toBe(true)
    expect(back!.leaves[0]!.uid).not.toBe(d.leaves[0]!.uid)
    back!.stem = 'lain'
    expect(sameDraft(back!, d)).toBe(false)
  })

  it('clears the snapshot', () => {
    const store = memory()
    saveSnapshot(store, recoveryKey('5'), filled())
    clearSnapshot(store, recoveryKey('5'))
    expect(loadSnapshot(store, recoveryKey('5'))).toBeNull()
  })

  it('ignores a value that is damaged, from another version or of the wrong shape', () => {
    expect(parseSnapshot(null)).toBeNull()
    expect(parseSnapshot('{bukan json')).toBeNull()
    expect(parseSnapshot(JSON.stringify({ v: 2, draft: filled() }))).toBeNull()
    expect(parseSnapshot(JSON.stringify({ v: 1, draft: { ...filled(), spIds: ['1', '2', '3', '4'] } }))).toBeNull()
    expect(parseSnapshot(JSON.stringify({ v: 1, draft: { ...filled(), kertas: '9' } }))).toBeNull()
    expect(parseSnapshot(JSON.stringify({ v: 1, draft: { ...filled(), leaves: [{ label: 'a', mode: 'essay' }] } }))).toBeNull()
    expect(parseSnapshot(JSON.stringify({ v: 1, draft: { ...filled(), stem: 5 } }))).toBeNull()
    expect(parseSnapshot(JSON.stringify({ v: 1, draft: '<script>' }))).toBeNull()
  })

  it('a blocked or full storage is never an error', () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('full')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    expect(() => saveSnapshot(broken, 'k', filled())).not.toThrow()
    expect(loadSnapshot(broken, 'k')).toBeNull()
    expect(() => clearSnapshot(broken, 'k')).not.toThrow()
  })
})
