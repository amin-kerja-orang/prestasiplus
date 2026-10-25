// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import DsConfirmHost from '../DsConfirmHost.vue'
import DsDataTable from '../DsDataTable.vue'
import { confirmState, settleConfirm, useConfirm } from '../useConfirm'

/**
 * G5-M27 B1: a mobile card value wraps instead of being cut with "...", so a long e-mail or class list stays
 * readable at 375. G5-M27 B9: the confirm dialog prints its message once.
 */
afterEach(() => {
  vi.unstubAllGlobals()
  if (confirmState.open) settleConfirm(false)
})

describe('DsDataTable cards', () => {
  it('lets a card value wrap (no truncate)', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
      onchange: null,
    }))
    const w = mount(DsDataTable, {
      props: {
        data: [{ id: 1, name: 'Murid Demo', email: 'murid.demo.yang.panjang@demo.test' }],
        columns: [
          { accessorKey: 'name', header: 'Nama' },
          { accessorKey: 'email', header: 'Emel' },
        ],
        cardTitle: 'name',
        cardFields: [{ key: 'email', label: 'Emel' }],
      },
    })
    await flushPromises()
    const dd = w.get('[data-ds=data-table-cards] dd')
    expect(dd.text()).toBe('murid.demo.yang.panjang@demo.test')
    expect(dd.classes()).not.toContain('truncate')
    expect(dd.classes()).toContain('break-words')
  })
})

describe('DsConfirmHost', () => {
  it('prints the message once', async () => {
    const w = mount(DsConfirmHost, {
      global: {
        stubs: {
          DsDialog: {
            name: 'DsDialog',
            props: ['description'],
            template: '<div><slot /><slot name="footer" /></div>',
          },
        },
      },
    })
    void useConfirm()({ message: 'Pasti untuk menukar status pengguna ini?' })
    await flushPromises()
    expect(w.text().split('Pasti untuk menukar status pengguna ini?')).toHaveLength(2)
    expect(w.get('[data-ds=confirm-message]').text()).toBe(
      'Pasti untuk menukar status pengguna ini?',
    )
    expect(w.findComponent({ name: 'DsDialog' }).props('description')).toBeUndefined()
  })
})
