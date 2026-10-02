// @vitest-environment jsdom
import { config, enableAutoUnmount, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import BaseModal from '../BaseModal.vue'
import { MODAL_CLASSES } from '../classes'

// Render <Transition> children directly (no stub element, no animation frames in jsdom).
config.global.stubs = {
  transition: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        slots.default?.(),
  }),
}
enableAutoUnmount(afterEach)

const q = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`)

type Props = InstanceType<typeof BaseModal>['$props']

function mountModal(props: Partial<Props> = {}, attrs: Record<string, string> = {}) {
  const wrapper: VueWrapper = mount(BaseModal, {
    props: {
      open: true,
      'onUpdate:open': (v: boolean) => wrapper.setProps({ open: v }),
      ...props,
    },
    attrs,
    slots: {
      default: ({ close }: { close: () => void }) => [
        h('h3', 'Lapor Soalan'),
        h('button', { type: 'button', 'data-testid': 'batal', onClick: close }, 'Batal'),
      ],
    },
    attachTo: document.body,
  })
  return wrapper
}

const classList = (el: HTMLElement | null) => [...(el?.classList ?? [])]

describe('BaseModal', () => {
  it('teleports to body and renders the slot inside the panel', () => {
    const w = mountModal()
    const container = q('cmp-modal')
    expect(container?.parentElement).toBe(document.body)
    expect(container?.textContent).toContain('Lapor Soalan')
    w.unmount()
  })

  it('renders nothing while closed', () => {
    const w = mountModal({ open: false })
    expect(q('cmp-modal')).toBeNull()
    w.unmount()
  })

  it('margin variant: live classes (full width with p-4 margins below md, centred max-w-lg, 90vh scroll)', () => {
    const w = mountModal()
    const container = q('cmp-modal')
    expect(container?.dataset.variant).toBe('margin')
    expect(classList(container)).toEqual(
      expect.arrayContaining([
        'fixed',
        'inset-0',
        'z-50',
        'flex',
        'items-center',
        'justify-center',
        'p-4',
      ]),
    )
    expect(classList(q('cmp-modal-backdrop'))).toEqual(['absolute', 'inset-0', 'bg-black/40'])
    const panel = q('cmp-modal-backdrop')?.nextElementSibling as HTMLElement
    expect(classList(panel)).toEqual(
      expect.arrayContaining([
        'w-full',
        'max-w-lg',
        'max-h-[90vh]',
        'overflow-y-auto',
        'rounded-2xl',
      ]),
    )
    w.unmount()
  })

  it('sheet variant: bottom-anchored below md, centred from md', () => {
    const w = mountModal({ variant: 'sheet' })
    const container = q('cmp-modal')
    expect(container?.dataset.variant).toBe('sheet')
    expect(classList(container)).toEqual(
      expect.arrayContaining(['z-[100]', 'items-end', 'md:items-center', 'p-4']),
    )
    expect(classList(q('cmp-modal-backdrop'))).toContain('bg-black/50')
    const panel = q('cmp-modal-backdrop')?.nextElementSibling as HTMLElement
    expect(classList(panel)).toEqual(
      expect.arrayContaining(['w-full', 'max-w-sm', 'overflow-hidden']),
    )
    w.unmount()
  })

  it('sheet defaults (live #ios-install-modal): no backdrop or Esc close, no transition', async () => {
    const w = mountModal({ variant: 'sheet' })
    expect(q('cmp-modal')?.dataset.transition).toBe('none')
    q('cmp-modal-backdrop')?.click()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(w.emitted('close')).toBeUndefined()
    expect(q('cmp-modal')).not.toBeNull()
    q('batal')?.click()
    await nextTick()
    expect(w.emitted('close')).toEqual([['button']])
    expect(q('cmp-modal')).toBeNull()
  })

  it('margin defaults to the fade transition', () => {
    mountModal()
    expect(q('cmp-modal')?.dataset.transition).toBe('fade')
  })

  it('props override the variant behaviour', async () => {
    const w = mountModal({
      variant: 'sheet',
      closeOnBackdrop: true,
      closeOnEsc: true,
      transition: 'fade',
    })
    expect(q('cmp-modal')?.dataset.transition).toBe('fade')
    q('cmp-modal-backdrop')?.click()
    await nextTick()
    expect(w.emitted('close')).toEqual([['backdrop']])

    await w.setProps({ open: true })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(w.emitted('close')).toEqual([['backdrop'], ['esc']])

    const m = mountModal({ transition: 'none' })
    expect(
      document.body.querySelectorAll<HTMLElement>('[data-testid="cmp-modal"]')[0]?.dataset
        .transition,
    ).toBe('none')
    m.unmount()
  })

  it('attributes go to the panel; class overrides replace the preset', () => {
    const w = mountModal(
      { panelClass: 'relative bg-white w-full max-w-2xl', containerClass: 'fixed inset-0 flex' },
      { 'data-testid': 'm04-report-modal', class: 'p-8' },
    )
    const panel = q('m04-report-modal')
    expect(classList(panel)).toEqual(['relative', 'bg-white', 'w-full', 'max-w-2xl', 'p-8'])
    expect(classList(q('cmp-modal'))).toEqual(['fixed', 'inset-0', 'flex'])
    w.unmount()
  })

  it('backdrop click closes with reason "backdrop"', async () => {
    const w = mountModal()
    q('cmp-modal-backdrop')?.click()
    await nextTick()
    expect(w.emitted('update:open')).toEqual([[false]])
    expect(w.emitted('close')).toEqual([['backdrop']])
    expect(q('cmp-modal')).toBeNull()
    w.unmount()
  })

  it('a click inside the panel does not close', async () => {
    const w = mountModal()
    document.body.querySelector('h3')?.click()
    await nextTick()
    expect(w.emitted('close')).toBeUndefined()
    w.unmount()
  })

  it('Esc on window closes with reason "esc"; other keys do nothing', async () => {
    const w = mountModal()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(w.emitted('close')).toBeUndefined()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(w.emitted('close')).toEqual([['esc']])
    // The listener is removed once closed.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('close')).toHaveLength(1)
    w.unmount()
  })

  it('the slot close() ("Batal" / X) closes with reason "button"', async () => {
    const w = mountModal()
    q('batal')?.click()
    await nextTick()
    expect(w.emitted('close')).toEqual([['button']])
    expect(q('cmp-modal')).toBeNull()
    w.unmount()
  })

  it('closeOnBackdrop / closeOnEsc false keep it open', async () => {
    const w = mountModal({ closeOnBackdrop: false, closeOnEsc: false })
    q('cmp-modal-backdrop')?.click()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(w.emitted('close')).toBeUndefined()
    expect(q('cmp-modal')).not.toBeNull()
    w.unmount()
  })

  it('reopens and closes again (listener re-attached)', async () => {
    const w = mountModal()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    await w.setProps({ open: true })
    expect(q('cmp-modal')).not.toBeNull()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(w.emitted('close')).toEqual([['esc'], ['esc']])
    w.unmount()
  })

  it('unmounting removes the Esc listener', () => {
    const w = mountModal()
    w.unmount()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('close')).toBeUndefined()
  })

  it('renders in place when teleport is disabled', () => {
    const w = mountModal({ teleportDisabled: true })
    expect(w.find('[data-testid="cmp-modal"]').exists()).toBe(true)
    w.unmount()
  })

  it('adds no dialog role, aria-modal or tabindex (D10)', () => {
    const w = mountModal()
    expect(q('cmp-modal')?.outerHTML).not.toMatch(/role=|aria-|tabindex/)
    w.unmount()
  })

  it('preset class strings are complete literals', () => {
    expect(MODAL_CLASSES.margin.panel).toBe(
      'relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto',
    )
  })
})
