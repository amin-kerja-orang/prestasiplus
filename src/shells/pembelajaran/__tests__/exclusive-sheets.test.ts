// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'

import { useExclusiveSheets } from '../useExclusiveSheets'

function setup(lg: boolean) {
  const lagi = ref(false)
  const picker = ref(false)
  const isLg = ref(lg)
  useExclusiveSheets(lagi, picker, isLg)
  return { lagi, picker, isLg }
}

describe('useExclusiveSheets', () => {
  it('the drawer is closed by default and the picker can open on its own', async () => {
    const { lagi, picker } = setup(true)
    picker.value = true
    await nextTick()
    expect(lagi.value).toBe(false)
    expect(picker.value).toBe(true)
  })

  it('opening the picker closes the drawer', async () => {
    const { lagi, picker } = setup(false)
    lagi.value = true
    await nextTick()
    picker.value = true
    await nextTick()
    expect(lagi.value).toBe(false)
    expect(picker.value).toBe(true)
  })

  it('opening the drawer closes the picker', async () => {
    const { lagi, picker } = setup(false)
    picker.value = true
    await nextTick()
    lagi.value = true
    await nextTick()
    expect(picker.value).toBe(false)
    expect(lagi.value).toBe(true)
  })

  it('the drawer closes when the static sidebar appears (>= lg)', async () => {
    const { lagi, isLg } = setup(false)
    lagi.value = true
    await nextTick()
    isLg.value = true
    await nextTick()
    expect(lagi.value).toBe(false)
  })
})
