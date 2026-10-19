// @vitest-environment jsdom
// Real <Transition> (no stub): transition "none" must insert and remove the sheet at once,
// like live `style.display` toggling.
import { enableAutoUnmount, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { h, nextTick } from 'vue'

import BaseModal from '../BaseModal.vue'

enableAutoUnmount(afterEach)

const modal = () => document.body.querySelector('[data-testid="cmp-modal"]')

describe('BaseModal with real transitions', () => {
  it('sheet (transition none) is removed synchronously on close', async () => {
    const w: VueWrapper = mount(BaseModal, {
      props: {
        open: true,
        variant: 'sheet',
        'onUpdate:open': (v: boolean) => w.setProps({ open: v }),
      },
      slots: {
        default: ({ close }: { close: () => void }) =>
          h('button', { type: 'button', 'data-testid': 'tutup', onClick: close }, 'Tutup'),
      },
      global: { stubs: { transition: false } },
      attachTo: document.body,
    })
    expect(modal()).not.toBeNull()
    expect(modal()?.className).not.toMatch(/opacity-0|v-enter|duration-/)
    document.body.querySelector<HTMLElement>('[data-testid="tutup"]')?.click()
    await nextTick()
    expect(modal()).toBeNull()
  })

  it('margin (fade) applies the live enter classes', async () => {
    const w = mount(BaseModal, {
      props: { open: false },
      global: { stubs: { transition: false } },
      attachTo: document.body,
    })
    await w.setProps({ open: true })
    expect(modal()?.className).toContain('transition ease-out duration-200')
  })
})
