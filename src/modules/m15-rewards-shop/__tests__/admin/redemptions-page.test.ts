// @vitest-environment jsdom
/**
 * R1-ADM-P2-08 `/admin/hadiah/tebusan` and the "Tebusan Queue" card against a mocked client (S7-T11; 30 P2-08,
 * 48 GAME-21, decisions 4, 5, 6 and 16 on #562): the status words, `Hantar kod`, `Batal` with its focus on `Batal`,
 * the stored consent row under `Semua`, the 409 of a repeated action, an out-of-range page.
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import AdminRedemptionsPage from '../../pages/AdminRedemptionsPage.vue'
import routes from '../../routes/admin'
import { DsDialogStub, queueBody, redemptionRow, routerAt } from './support'

const api = vi.hoisted(() => ({
  fetchRedemptions: vi.fn(),
  deliverRedemption: vi.fn(),
  cancelRedemption: vi.fn(),
}))
vi.mock('../../api/admin', () => api)

const PENDING = redemptionRow()
const CONSENT = redemptionRow({
  id: '15102',
  rewardTitle: 'Roblox Gift Card RM10',
  user: { id: '4', name: 'Pelajar Maju Demo', email: 'pelajarmaju@demo.test' },
  status: 'pending_parent_consent',
})
const DELIVERED = redemptionRow({ id: '15103', rewardTitle: 'McD e-Voucher RM10', status: 'delivered' })
const CANCELLED = redemptionRow({ id: '3', rewardTitle: 'Hotlink Topup RM10', status: 'cancelled' })

async function open(props: Record<string, unknown> = {}, at = '/admin/hadiah/tebusan'): Promise<VueWrapper> {
  const router = routerAt()
  await router.push(at)
  await router.isReady()
  const w = mount(AdminRedemptionsPage, {
    props,
    global: { plugins: [router], stubs: { DsDialog: DsDialogStub } },
    attachTo: document.body,
  })
  await flushPromises()
  return w
}

const tid = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`)
const flash = () => useFlashStore().current
const calls = () => api.fetchRedemptions.mock.calls.map((c) => c[0])

beforeEach(() => {
  document.body.innerHTML = ''
  setActivePinia(createPinia())
  for (const f of Object.values(api)) f.mockReset()
  api.fetchRedemptions.mockImplementation(({ status }: { status: string }) => {
    if (status === 'all') {
      return Promise.resolve(queueBody([PENDING, CONSENT, DELIVERED, CANCELLED], { activeStatus: 'all' }))
    }
    if (status === 'delivered') return Promise.resolve(queueBody([DELIVERED], { activeStatus: 'delivered' }))
    if (status === 'cancelled') return Promise.resolve(queueBody([CANCELLED], { activeStatus: 'cancelled' }))
    return Promise.resolve(queueBody([PENDING]))
  })
})

describe('route', () => {
  it('is /admin/hadiah/tebusan in the admin shell, admin only', () => {
    const route = routes.find((r) => r.path === '/admin/hadiah/tebusan')
    expect(route?.meta).toMatchObject({
      layout: 'admin',
      roles: ['admin'],
      header: { title: '📋 Tebusan Hadiah Pelajar' },
    })
  })
})

describe('the status pills (decision 5)', () => {
  it('shows Menunggu (default), Dihantar, Dibatalkan and Semua, and none of the V1 words', async () => {
    const w = await open()
    const nav = w.get('nav[aria-label="Status tebusan"]')
    expect(nav.findAll('button').map((b) => b.text())).toEqual(['Menunggu', 'Dihantar', 'Dibatalkan', 'Semua'])
    expect(tid(w, 'tebusan-pill-pending_admin').attributes('data-active')).toBe('true')
    expect(w.text()).not.toMatch(/Pending Admin|Delivered|Cancelled|Pending Ibu Bapa/)
    expect(calls()[0]).toMatchObject({ status: 'pending_admin', page: 1 })
  })

  it('asks the server for the chosen status, from page 1', async () => {
    const w = await open()
    await tid(w, 'tebusan-pill-delivered').trigger('click')
    await flushPromises()
    expect(calls().at(-1)).toMatchObject({ status: 'delivered', page: 1 })
    expect(tid(w, 'tebusan-status-15103').text()).toBe('Dihantar')
    await tid(w, 'tebusan-pill-cancelled').trigger('click')
    await flushPromises()
    expect(tid(w, 'tebusan-status-3').text()).toBe('Dibatalkan')
  })

  it('opens on ?status= for the route page, always on Menunggu for the card', async () => {
    const route = await open({}, '/admin/hadiah/tebusan?status=delivered')
    expect(calls().at(-1)).toMatchObject({ status: 'delivered' })
    route.unmount()
    api.fetchRedemptions.mockClear()
    await open({ embedded: true }, '/admin/hadiah?status=delivered')
    expect(calls().at(-1)).toMatchObject({ status: 'pending_admin' })
  })

  it('says "Tiada tebusan dalam status ini." for an empty status', async () => {
    api.fetchRedemptions.mockResolvedValue(queueBody([]))
    const w = await open()
    expect(w.text()).toContain('Tiada tebusan dalam status ini.')
  })
})

describe('the rows', () => {
  it('shows the student, reward, RM, token, status word and the date with its year', async () => {
    const w = await open()
    const row = w.get('tr[data-index], tbody tr')
    expect(row.text()).toContain('Pelajar Demo')
    expect(row.text()).toContain('pelajar@demo.test')
    expect(row.text()).toContain('TnG eWallet RM10')
    expect(row.text()).toContain('Menunggu')
    expect(row.text()).toContain('24/09/2026')
    const heads = w.findAll('th').map((h) => h.text())
    expect(heads).toEqual(['Pelajar', 'Hadiah', 'RM', 'Token', 'Status', 'Tarikh', 'Tindakan'])
  })

  it('offers Hantar kod and Batal on Menunggu, Batal only on the stored consent row, nothing on the rest (decision 6)', async () => {
    const w = await open()
    await tid(w, 'tebusan-pill-all').trigger('click')
    await flushPromises()
    expect(tid(w, 'tebusan-deliver-15101').text()).toBe('Hantar kod')
    expect(tid(w, 'tebusan-cancel-15101').text()).toBe('Batal')
    expect(tid(w, 'tebusan-status-15102').text()).toBe('Menunggu Ibu Bapa')
    expect(tid(w, 'tebusan-deliver-15102').exists()).toBe(false)
    expect(tid(w, 'tebusan-cancel-15102').exists()).toBe(true)
    for (const id of ['15103', '3']) {
      expect(tid(w, `tebusan-deliver-${id}`).exists()).toBe(false)
      expect(tid(w, `tebusan-cancel-${id}`).exists()).toBe(false)
    }
  })

  it('never lists the consent row under Menunggu', async () => {
    const w = await open()
    expect(tid(w, 'tebusan-cancel-15102').exists()).toBe(false)
  })
})

describe('Hantar kod', () => {
  async function dialog() {
    const w = await open()
    await tid(w, 'tebusan-deliver-15101').trigger('click')
    return w
  }

  it('asks for the code, and a blank one is refused in the dialog without a request', async () => {
    const w = await dialog()
    expect(w.get('[role="dialog"]').attributes('data-dialog')).toBe('Hantar kod')
    expect(w.text()).toContain('Kod baucar')
    await tid(w, 'tebusan-deliver-form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Kod baucar diperlukan.')
    expect(api.deliverRedemption).not.toHaveBeenCalled()
  })

  it('sends the code with the row id, says it was sent and reads the list again; no notification is made', async () => {
    api.deliverRedemption.mockResolvedValue({ id: '15101', status: 'delivered' })
    const w = await dialog()
    await tid(w, 'tebusan-code').setValue('ABC-123')
    await tid(w, 'tebusan-deliver-form').trigger('submit')
    await flushPromises()
    expect(api.deliverRedemption).toHaveBeenCalledWith('15101', 'ABC-123')
    expect(flash()).toEqual({ type: 'success', message: 'Kod dihantar kepada pelajar.' })
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    expect(api.fetchRedemptions).toHaveBeenCalledTimes(2)
  })

  it('shows the server message at the field (a code that is too long)', async () => {
    api.deliverRedemption.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: { code: 'Kod baucar tidak boleh melebihi 100 aksara.' },
      }),
    )
    const w = await dialog()
    await tid(w, 'tebusan-code').setValue('x'.repeat(101))
    await tid(w, 'tebusan-deliver-form').trigger('submit')
    await flushPromises()
    expect(w.get('[data-testid="field-error"]').text()).toContain('Kod baucar tidak boleh melebihi 100 aksara.')
    expect(w.find('[role="dialog"]').exists()).toBe(true)
  })

  it('a row settled meanwhile (409) closes the dialog, shows the server text and refreshes', async () => {
    api.deliverRedemption.mockRejectedValue(
      new ApiError({ status: 409, code: 'CONFLICT', message: 'Tebusan ini tidak lagi menunggu pemprosesan.' }),
    )
    const w = await dialog()
    await tid(w, 'tebusan-code').setValue('A')
    await tid(w, 'tebusan-deliver-form').trigger('submit')
    await flushPromises()
    expect(flash()).toEqual({ type: 'error', message: 'Tebusan ini tidak lagi menunggu pemprosesan.' })
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    expect(api.fetchRedemptions).toHaveBeenCalledTimes(2)
  })

  it('any other failure stays in the dialog with the common text', async () => {
    api.deliverRedemption.mockRejectedValue(new Error('boom'))
    const w = await dialog()
    await tid(w, 'tebusan-code').setValue('A')
    await tid(w, 'tebusan-deliver-form').trigger('submit')
    await flushPromises()
    expect(tid(w, 'tebusan-deliver-failure').text()).toContain('Ralat berlaku. Sila cuba lagi.')
  })
})

describe('Batal (AC-GM-21.5, AC-GM-21.8)', () => {
  async function dialog() {
    const w = await open()
    await tid(w, 'tebusan-cancel-15101').trigger('click')
    return w
  }

  it('confirms with the exact BM copy and the focus on Batal, not on the confirm button', async () => {
    const w = await dialog()
    const box = w.get('[role="dialog"]')
    expect(box.attributes('data-dialog')).toBe('Batalkan tebusan ini?')
    expect(box.text()).toContain('Token pelajar akan dipulangkan.')
    expect(tid(w, 'tebusan-cancel-keep').text()).toBe('Batal')
    expect(tid(w, 'tebusan-cancel-go').text()).toBe('Ya, Batalkan')
    expect(document.activeElement).toBe(tid(w, 'tebusan-cancel-keep').element)
    expect(api.cancelRedemption).not.toHaveBeenCalled()
  })

  it('Batal keeps the redemption: no request, the dialog closes', async () => {
    const w = await dialog()
    await tid(w, 'tebusan-cancel-keep').trigger('click')
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    expect(api.cancelRedemption).not.toHaveBeenCalled()
  })

  it('Ya, Batalkan cancels once and reads the list again', async () => {
    api.cancelRedemption.mockResolvedValue({ id: '15101', status: 'cancelled', refundedTokens: 10 })
    const w = await dialog()
    await tid(w, 'tebusan-cancel-go').trigger('click')
    await flushPromises()
    expect(api.cancelRedemption).toHaveBeenCalledTimes(1)
    expect(api.cancelRedemption).toHaveBeenCalledWith('15101')
    expect(flash()?.type).toBe('success')
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    expect(api.fetchRedemptions).toHaveBeenCalledTimes(2)
  })

  it('a second cancel (409) shows the server text instead of refunding again', async () => {
    api.cancelRedemption.mockRejectedValue(
      new ApiError({ status: 409, code: 'CONFLICT', message: 'Tebusan ini tidak lagi menunggu pemprosesan.' }),
    )
    const w = await dialog()
    await tid(w, 'tebusan-cancel-go').trigger('click')
    await flushPromises()
    expect(flash()).toEqual({ type: 'error', message: 'Tebusan ini tidak lagi menunggu pemprosesan.' })
    expect(api.fetchRedemptions).toHaveBeenCalledTimes(2)
  })

  it('cancels the stored consent row under Semua', async () => {
    api.cancelRedemption.mockResolvedValue({ id: '15102', status: 'cancelled', refundedTokens: 10 })
    const w = await open()
    await tid(w, 'tebusan-pill-all').trigger('click')
    await flushPromises()
    await tid(w, 'tebusan-cancel-15102').trigger('click')
    await tid(w, 'tebusan-cancel-go').trigger('click')
    await flushPromises()
    expect(api.cancelRedemption).toHaveBeenCalledWith('15102')
  })
})

describe('paging and states', () => {
  it('goes back to the last page when the page asked for is past it', async () => {
    api.fetchRedemptions.mockImplementation(({ page }: { page: number }) =>
      Promise.resolve(
        page > 2 ? queueBody([], { page, totalPages: 2 }) : queueBody([PENDING], { page, totalPages: 2 }),
      ),
    )
    const w = await open()
    expect(w.text()).toContain('TnG eWallet RM10')
    // The table pager moves the model; the answer for page 3 is empty with totalPages 2.
    await w.findComponent({ name: 'DsDataTable' }).vm.$emit('update:page', 3)
    await flushPromises()
    expect(calls().map((c) => c.page)).toEqual([1, 3, 2])
  })

  it('shows the common load error with a retry when the list fails', async () => {
    api.fetchRedemptions.mockRejectedValueOnce(new Error('down'))
    const w = await open()
    expect(w.text()).toContain('Maaf, berlaku ralat. Sila cuba semula.')
    expect(w.text()).not.toContain('TnG eWallet RM10')
    await w.findAll('button').find((b) => b.text() === 'Cuba Semula')!.trigger('click')
    await flushPromises()
    expect(w.text()).toContain('TnG eWallet RM10')
  })
})

describe('as the card of /admin/hadiah (decision 4)', () => {
  it('has the title "Tebusan Queue" and no back link; the route page has the link and no card title', async () => {
    const card = await open({ embedded: true }, '/admin/hadiah')
    expect(tid(card, 'tebusan-card-title').text()).toBe('Tebusan Queue')
    expect(card.text()).not.toContain('Kembali')
    card.unmount()
    const page = await open()
    expect(tid(page, 'tebusan-card-title').exists()).toBe(false)
    expect(page.text()).toContain('Kembali')
  })
})
