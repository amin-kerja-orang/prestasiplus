// @vitest-environment jsdom
// REQ-A-025 (AC-07.7): Tarik balik asks the V2 confirm first.
import type { BijakBuilderReview } from '@pp/contract'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { usePaperActions } from '../admin/builder/lib/use-paper-actions'
import type { BuilderApi } from '../admin/builder/server/api'


const review = (over: Partial<BijakBuilderReview> = {}): BijakBuilderReview => ({
  paperId: 'p1', status: 'draf', ok: true, blockers: [], blockerDetails: [], canOverride: false, notes: [],
  blueprintNeedsReview: false, visibleToStudents: false, totalMarks: 40, totalBudget: 40, rows: [], ...over,
})

async function setup(api: Partial<Record<keyof BuilderApi, ReturnType<typeof vi.fn>>>) {
  setActivePinia(createPinia())
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div/>' } }] })
  let actions!: ReturnType<typeof usePaperActions>
  const C = defineComponent({
    setup() {
      actions = usePaperActions({ api: api as unknown as BuilderApi, id: ref('p1'), title: () => 'Set', onChanged: () => undefined })
      return () => null
    },
  })
  mount(C, { global: { plugins: [router] } })
  await actions.loadReview()
  await flushPromises()
  return actions
}


const TEXT = 'Tarik balik kertas ini ke draf? Pelajar tidak lagi dapat mengaksesnya.'

describe('usePaperActions: Tarik balik confirm (AC-07.7)', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('shows the V2 text; cancel withdraws nothing', async () => {
    const withdraw = vi.fn().mockResolvedValue(undefined)
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const a = await setup({ review: vi.fn().mockResolvedValue(review()), withdraw })
    await a.withdraw()
    expect(ask).toHaveBeenCalledWith(TEXT)
    expect(withdraw).not.toHaveBeenCalled()
  })

  it('ok withdraws once', async () => {
    const withdraw = vi.fn().mockResolvedValue(undefined)
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const a = await setup({ review: vi.fn().mockResolvedValue(review()), withdraw })
    await a.withdraw()
    expect(ask).toHaveBeenCalledWith(TEXT)
    expect(withdraw).toHaveBeenCalledWith('p1')
  })
})
