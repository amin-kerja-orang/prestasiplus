import { describe, expect, it } from 'vitest'

import { createDraftSaver, draftSavedFlash, type SaveState } from '../admin/intake/lib/draft-saver'

function setup(run: () => Promise<void>, canSave = true) {
  const states: SaveState[] = []
  const saver = createDraftSaver({
    canSave: () => canSave,
    run,
    onState: (s) => states.push(s),
  })
  return { saver, states }
}

describe('Simpan draf flash (UAT A-KS16)', () => {
  it('success flash when the batch was saved', async () => {
    const { saver, states } = setup(() => Promise.resolve())
    const saved = await saver.save()
    expect(saved).toBe(true)
    expect(states).toEqual(['menyimpan', 'tersimpan'])
    expect(draftSavedFlash(saved)).toEqual({ type: 'success', message: 'Draf disimpan.' })
  })

  it('error flash when the server rejects', async () => {
    const { saver, states } = setup(() => Promise.reject(new Error('x')))
    const saved = await saver.save()
    expect(saved).toBe(false)
    expect(states).toEqual(['menyimpan', 'gagal'])
    expect(draftSavedFlash(saved)).toEqual({
      type: 'error',
      message: 'Draf tidak dapat disimpan. Cuba lagi.',
    })
  })

  it('does not claim a save when there is nothing to save (batch no longer a Draf)', async () => {
    let ran = false
    const { saver, states } = setup(() => {
      ran = true
      return Promise.resolve()
    }, false)
    const saved = await saver.save()
    expect(saved).toBe(false)
    expect(ran).toBe(false)
    expect(states).toEqual([])
    expect(draftSavedFlash(saved).type).toBe('error')
  })

  it('waits for an autosave in flight and reports its own result, not the autosave state', async () => {
    const order: string[] = []
    let release!: () => void
    let calls = 0
    const { saver } = setup(() => {
      const n = ++calls
      order.push(`start${n}`)
      if (n === 1)
        return new Promise<void>((resolve) => {
          release = () => {
            order.push('end1')
            resolve()
          }
        })
      order.push('end2')
      return Promise.resolve()
    })
    const auto = saver.save()
    const manual = saver.save()
    await Promise.resolve()
    expect(order).toEqual(['start1'])
    release()
    expect(await auto).toBe(true)
    expect(await manual).toBe(true)
    expect(order).toEqual(['start1', 'end1', 'start2', 'end2'])
  })

  it('a failed autosave does not make the following manual save fail', async () => {
    let n = 0
    const { saver } = setup(() => (++n === 1 ? Promise.reject(new Error('x')) : Promise.resolve()))
    const auto = saver.save()
    const manual = saver.save()
    expect(await auto).toBe(false)
    expect(await manual).toBe(true)
  })
})
