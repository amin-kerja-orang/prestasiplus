// @vitest-environment jsdom
// REQ-B-054: a refused publish keeps the server's reason lines and the override offer (from the refusal itself).
import type { BijakBuilderReview } from '@pp/contract'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { usePaperActions } from '../admin/builder/lib/use-paper-actions'
import type { BuilderApi } from '../admin/builder/server/api'

const KONTRAK = 'Kontrak Simulasi 1449/1 (versi 2) belum Disahkan (status: Spec); Terbit memerlukan kontrak Disahkan.'
const HARD = 'Bahagian A: Kurang 1 soalan (perlu 40, ada 39)'

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

describe('usePaperActions: publish refusal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('BLUEPRINT_NOT_VERIFIED from the publish response: reason and override are kept even if the reload fails', async () => {
    const details = [{ code: 'BLUEPRINT_NOT_VERIFIED', message: KONTRAK, overridable: true }]
    const reviewFn = vi.fn().mockResolvedValueOnce(review()).mockRejectedValue(new Error('x'))
    const a = await setup({
      review: reviewFn,
      publish: vi.fn().mockResolvedValue({ ok: false, errors: [KONTRAK], blockerDetails: details, canOverride: true }),
    })
    await a.publish()
    expect(a.blockers.value).toEqual([KONTRAK])
    expect(a.blockerInfo.value[0]?.overridable).toBe(true)
    expect(a.overrideAvailable.value).toBe(true)
  })

  it('review with a Kontrak blocker: reason listed and override offered', async () => {
    const a = await setup({
      review: vi.fn().mockResolvedValue(
        review({ ok: false, blockers: [KONTRAK], blockerDetails: [{ code: 'BLUEPRINT_NOT_VERIFIED', message: KONTRAK, overridable: true }], canOverride: true }),
      ),
    })
    expect(a.publishBlocked.value).toBe(true)
    expect(a.blockers.value).toEqual([KONTRAK])
    expect(a.overrideAvailable.value).toBe(true)
  })

  it('hard blocker: reason listed, no override', async () => {
    const a = await setup({
      review: vi.fn().mockResolvedValue(
        review({ ok: false, blockers: [HARD, KONTRAK], blockerDetails: [{ code: 'COUNT_TOO_FEW', message: HARD, overridable: false }, { code: 'BLUEPRINT_NOT_VERIFIED', message: KONTRAK, overridable: true }], canOverride: false }),
      ),
    })
    expect(a.blockers.value).toEqual([HARD, KONTRAK])
    expect(a.overrideAvailable.value).toBe(false)
  })
})
