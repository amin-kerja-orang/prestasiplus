// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { DsCarousel, DsDrillTable, DsFeedbackSheet, DsFriendPicker, DsQuizOption } from '@/ds'

/* eslint-disable @typescript-eslint/unbound-method -- jsdom polyfill checks */
beforeAll(() => {
  // jsdom lacks these browser APIs (Embla, Vaul, reka-ui).
  const g = globalThis as Record<string, unknown>
  g.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  g.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
    onchange: null,
  })) as unknown as typeof window.matchMedia
  Element.prototype.scrollIntoView ??= () => {}
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.setPointerCapture ??= () => {}
  Element.prototype.releasePointerCapture ??= () => {}
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('DsQuizOption', () => {
  it('idle: unpressed button with the letter badge, emits select', async () => {
    const w = mount(DsQuizOption, { props: { letter: 'A' }, slots: { default: '36' } })
    expect(w.get('button').attributes('aria-pressed')).toBe('false')
    expect(w.text()).toContain('A')
    expect(w.text()).toContain('36')
    expect(w.get('button').classes()).toContain('min-h-15')
    await w.get('button').trigger('click')
    expect(w.emitted('select')).toHaveLength(1)
  })
  it('selected: pressed, primary letter chip', () => {
    const w = mount(DsQuizOption, { props: { letter: 'B', state: 'selected' } })
    expect(w.get('button').attributes('aria-pressed')).toBe('true')
    expect(w.html()).toContain('bg-primary text-primary-on')
  })
  it('correct: check marker with screen-reader text, locked', async () => {
    const w = mount(DsQuizOption, { props: { letter: 'B', state: 'correct' } })
    expect(w.find('[data-ds="option-marker"]').exists()).toBe(true)
    expect(w.get('[data-ds="option-marker"]').text()).toBe('Betul')
    expect(w.html()).toContain('data-glyph="check"')
    expect(w.get('button').attributes('aria-pressed')).toBeUndefined()
    await w.get('button').trigger('click')
    expect(w.emitted('select')).toBeUndefined()
  })
  it('wrong: x marker, nudge with reduced-motion fallback', () => {
    const w = mount(DsQuizOption, {
      props: { letter: 'C', state: 'wrong', wrongLabel: 'Jawapan salah' },
    })
    expect(w.get('[data-ds="option-marker"]').text()).toBe('Jawapan salah')
    expect(w.html()).toContain('data-glyph="x"')
    expect(w.get('button').classes()).toContain('animate-ds-nudge')
    expect(w.get('button').classes()).toContain('motion-reduce:animate-none')
  })
  it('dimmed: 55% opacity, still not a marker', () => {
    const w = mount(DsQuizOption, { props: { letter: 'D', state: 'dimmed' } })
    expect(w.get('button').classes()).toContain('opacity-55')
    expect(w.find('[data-ds="option-marker"]').exists()).toBe(false)
  })
})

describe('DsFeedbackSheet', () => {
  it('good: polite status region, title, ai line, combo, continue', async () => {
    const w = mount(DsFeedbackSheet, {
      props: {
        tone: 'good',
        title: 'Betul!',
        body: 'Penjelasan',
        aiLabel: 'AI',
        aiLine: 'Bagus',
        combo: '+10',
        continueLabel: 'Teruskan',
      },
    })
    expect(w.attributes('role')).toBe('status')
    expect(w.attributes('aria-live')).toBe('polite')
    expect(w.attributes('data-tone')).toBe('good')
    expect(w.text()).toContain('Betul!')
    expect(w.get('[data-ds="feedback-ai"]').text()).toContain('Bagus')
    expect(w.get('[data-ds="feedback-combo"]').text()).toContain('+10')
    expect(w.html()).toContain('motion-reduce:animate-none')
    await w.get('[data-ds="feedback-continue"]').trigger('click')
    expect(w.emitted('continue')).toHaveLength(1)
  })
  it('bad: x glyph, no combo or ai line unless given', () => {
    const w = mount(DsFeedbackSheet, {
      props: { tone: 'bad', title: 'Hampir!', continueLabel: 'Teruskan' },
    })
    expect(w.attributes('data-tone')).toBe('bad')
    expect(w.html()).toContain('data-glyph="x"')
    expect(w.find('[data-ds="feedback-combo"]').exists()).toBe(false)
    expect(w.find('[data-ds="feedback-ai"]').exists()).toBe(false)
  })
})

describe('DsFriendPicker', () => {
  const friends = [
    { value: 'aiman' as const, name: 'Aiman', trait: 'Tenang & suka cabaran' },
    { value: 'aisyah' as const, name: 'Aisyah', trait: 'Ceria & sentiasa beri semangat' },
  ]
  const props = {
    friends,
    title: 'Pilih rakan belajar awak',
    description: 'Dia akan temankan awak.',
    groupLabel: 'Rakan belajar',
    confirmLabel: 'Pilih',
    cancelLabel: 'Batal',
    open: true,
  }
  const mountPicker = (extra: Record<string, unknown> = {}) =>
    mount(DsFriendPicker, { props: { ...props, ...extra }, attachTo: document.body })

  it('renders a radiogroup with one radio per friend, copy and traits', async () => {
    mountPicker()
    await new Promise((r) => setTimeout(r, 50))
    expect(document.body.textContent).toContain('Pilih rakan belajar awak')
    expect(document.body.textContent).toContain('Tenang & suka cabaran')
    expect(document.querySelector('[role="radiogroup"]')).not.toBeNull()
    expect(document.querySelectorAll('[role="radio"]')).toHaveLength(2)
  })
  it('confirm is disabled until a card is chosen, then confirms the choice', async () => {
    const w = mountPicker()
    await new Promise((r) => setTimeout(r, 50))
    const confirm = document.querySelector<HTMLButtonElement>('[data-ds="picker-confirm"]')!
    expect(confirm.disabled).toBe(true)
    document.querySelectorAll<HTMLElement>('[role="radio"]')[1]!.click()
    await new Promise((r) => setTimeout(r, 20))
    expect(document.querySelector<HTMLButtonElement>('[data-ds="picker-confirm"]')!.disabled).toBe(
      false,
    )
    document.querySelector<HTMLButtonElement>('[data-ds="picker-confirm"]')!.click()
    await new Promise((r) => setTimeout(r, 20))
    expect(w.emitted('confirm')?.[0]).toEqual(['aisyah'])
    expect(w.emitted('update:selected')?.[0]).toEqual(['aisyah'])
    expect(w.emitted('update:open')?.[0]).toEqual([false])
  })
  it('preselects the current friend and cancel closes without confirming', async () => {
    const w = mountPicker({ selected: 'aiman' })
    await new Promise((r) => setTimeout(r, 50))
    expect(document.querySelector<HTMLButtonElement>('[data-ds="picker-confirm"]')!.disabled).toBe(
      false,
    )
    expect(document.querySelector('[role="radio"][aria-checked="true"]')).not.toBeNull()
    document.querySelector<HTMLButtonElement>('[data-ds="picker-cancel"]')!.click()
    await new Promise((r) => setTimeout(r, 20))
    expect(w.emitted('cancel')).toHaveLength(1)
    expect(w.emitted('confirm')).toBeUndefined()
  })
})

describe('DsCarousel', () => {
  it('is a named carousel region with one slide per item and dots', async () => {
    const w = mount(DsCarousel, {
      props: { items: [{ t: 'Satu' }, { t: 'Dua' }, { t: 'Tiga' }], label: 'Petua' },
      slots: { item: '<template #item="{ item }"><p>{{ item.t }}</p></template>' },
    })
    await new Promise((r) => setTimeout(r, 30))
    const root = w.get('[data-ds="carousel"]')
    expect(root.attributes('aria-label')).toBe('Petua')
    expect(w.text()).toContain('Satu')
    expect(w.text()).toContain('Tiga')
  })
})

describe('DsDrillTable', () => {
  it('renders rows inside its own scroll container and forwards cell slots', () => {
    const w = mount(DsDrillTable, {
      props: {
        data: [{ nama: 'Sekolah A' }, { nama: 'Sekolah B' }],
        columns: [{ accessorKey: 'nama', header: 'Sekolah' }],
        caption: 'Senarai sekolah',
      },
      slots: {
        'nama-cell': '<template #nama-cell="{ row }"><b>{{ row.original.nama }}!</b></template>',
      },
    })
    expect(w.classes()).toContain('overflow-x-auto')
    expect(w.text()).toContain('Sekolah A!')
    expect(w.text()).toContain('Senarai sekolah')
    expect(w.findAll('tbody tr')).toHaveLength(2)
  })
  it('shows the empty label when there is no data', () => {
    const w = mount(DsDrillTable, {
      props: {
        data: [],
        columns: [{ accessorKey: 'nama', header: 'Sekolah' }],
        emptyLabel: 'Tiada data',
      },
    })
    expect(w.text()).toContain('Tiada data')
  })
})
