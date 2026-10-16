// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/unbound-method -- jsdom polyfill checks */
import { mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { h } from 'vue'

import {
  DsFriendPicker,
  DsHeroCard,
  DsIcon,
  DsQuizHeader,
  DsQuizOption,
  DsRewardChip,
  DsSubjectStrip,
  DsThemeScope,
  DsWinScreen,
} from '@/ds'

import DsGalleryShowcase from '@/dev/ds/DsGalleryShowcase.vue'

const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms))

beforeAll(() => {
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

describe('DsIcon', () => {
  const inScope = (
    personality: 'staff' | 'learner',
    props: { name: string; weight?: 'regular' | 'duotone' | 'bold' },
  ) =>
    mount(DsThemeScope, {
      props: { personality, scheme: 'light' },
      slots: { default: () => h(DsIcon, props) },
    })
  it('defaults to Duotone for the learner and Regular for staff', () => {
    expect(
      inScope('learner', { name: 'house' }).get('[data-ds="icon"]').attributes('data-weight'),
    ).toBe('duotone')
    expect(
      inScope('staff', { name: 'house' }).get('[data-ds="icon"]').attributes('data-weight'),
    ).toBe('regular')
  })
  it('an explicit weight wins', () => {
    const w = inScope('learner', { name: 'check', weight: 'bold' })
    expect(w.get('[data-ds="icon"]').attributes('data-weight')).toBe('bold')
  })
})

describe('DsHeroCard', () => {
  it('shows overline, title, subtitle, CTA and a labelled ring, and emits cta', async () => {
    const w = mount(DsHeroCard, {
      props: {
        overline: 'Sambung latihan',
        title: 'Matematik',
        subtitle: '12 daripada 20',
        progress: 60,
        ringLabel: 'Kemajuan',
        art: 'rocket',
        ctaLabel: 'Mula',
      },
    })
    expect(w.attributes('aria-labelledby')).toBeTruthy()
    expect(w.text()).toContain('Sambung latihan')
    expect(w.get('[role="meter"]').attributes('aria-valuenow')).toBe('60')
    expect(w.find('img[data-art="rocket"]').exists()).toBe(true)
    expect(w.find('[data-ds="hero-glow"]').exists()).toBe(true)
    expect(w.classes()).toContain('bg-gradient-primary')
    await w.get('[data-ds="hero-cta"]').trigger('click')
    expect(w.emitted('cta')).toHaveLength(1)
  })
  it('omits ring, art and CTA when not given', () => {
    const w = mount(DsHeroCard, { props: { overline: 'o', title: 't' } })
    expect(w.find('[role="meter"]').exists()).toBe(false)
    expect(w.find('img').exists()).toBe(false)
    expect(w.find('[data-ds="hero-cta"]').exists()).toBe(false)
  })
})

describe('DsRewardChip', () => {
  it('3D art, glyph and label variants', () => {
    const art = mount(DsRewardChip, { props: { art: 'coin', value: 86, label: 'koin' } })
    expect(art.find('img[data-art="coin"]').exists()).toBe(true)
    expect(art.text()).toContain('86')
    expect(art.text()).toContain('koin')
    const glyph = mount(DsRewardChip, { props: { icon: 'fire', value: 12 } })
    expect(glyph.find('[data-ds="icon"]').exists()).toBe(true)
    expect(glyph.find('img').exists()).toBe(false)
  })
})

describe('DsQuizHeader', () => {
  it('close button is named and emits; progress is labelled; combo lights up', async () => {
    const w = mount(DsQuizHeader, {
      props: {
        closeLabel: 'Tutup latihan',
        progress: 40,
        progressLabel: 'Kemajuan latihan',
        combo: 3,
        comboLabel: 'Kombo',
      },
    })
    const close = w.get('[data-ds="quiz-close"]')
    expect(close.attributes('aria-label')).toBe('Tutup latihan')
    await close.trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
    expect(w.get('[role="progressbar"]').attributes('aria-label')).toBe('Kemajuan latihan')
    const chip = w.get('[data-ds="combo-chip"]')
    expect(chip.attributes('data-lit')).toBe('true')
    expect(chip.text()).toContain('Kombo')
    expect(chip.html()).toContain('motion-reduce:animate-none')
  })
  it('combo 0 is not lit', () => {
    const w = mount(DsQuizHeader, { props: { closeLabel: 'x', progress: 0, progressLabel: 'y' } })
    expect(w.get('[data-ds="combo-chip"]').attributes('data-lit')).toBe('false')
  })
})

describe('DsSubjectStrip', () => {
  it('renders a named list of tiles inside its own scroll container and emits select', async () => {
    const w = mount(DsSubjectStrip, {
      props: {
        label: 'Mata pelajaran',
        items: [
          { id: 'mat', label: 'Matematik', icon: 'i-ph-calculator-duotone' },
          { id: 'bm', label: 'B. Melayu', icon: 'i-ph-book-open-text-duotone' },
        ],
      },
    })
    expect(w.attributes('aria-label')).toBe('Mata pelajaran')
    expect(w.classes()).toContain('overflow-x-auto')
    expect(w.findAll('[data-ds="subject-tile"]')).toHaveLength(2)
    await w.findAll('[data-ds="subject-tile"]')[1]!.trigger('click')
    expect(w.emitted('select')?.[0]).toEqual(['bm'])
  })
})

describe('DsWinScreen', () => {
  const base = {
    art: 'trophy' as const,
    title: 'Hebat!',
    max: 5,
    ringLabel: 'Skor',
    rewards: [{ id: 'p', value: '+50', unit: 'Mata', art: 'bolt' as const }],
    stickers: [{ id: 's', text: 'Tahap naik!' }],
  }
  it('follows the approved order and uses the win tone from 3/5', () => {
    const w = mount(DsWinScreen, {
      props: { ...base, score: 3 },
      slots: {
        friend: '<p data-test="f">dialog</p>',
        actions: '<button data-test="a">Kembali</button>',
      },
    })
    const html = w.html()
    const order = [
      'data-ds="win-hero"',
      'data-ds="score-ring"',
      'data-ds="win-friend"',
      'data-ds="stat-tile"',
      'data-ds="sticker"',
      'data-ds="win-actions"',
    ]
    const idx = order.map((k) => html.indexOf(k))
    expect(idx.every((i) => i >= 0)).toBe(true)
    expect([...idx].sort((a, b) => a - b)).toEqual(idx)
    expect(w.get('[data-ds="win-hero"]').attributes('data-tone')).toBe('win')
    expect(w.get('[data-ds="ring-bar"]').classes()).toContain('text-win-ring')
  })
  it('below 3/5 the tone is keep and the ring is primary', () => {
    const w = mount(DsWinScreen, { props: { ...base, score: 2 } })
    expect(w.get('[data-ds="win-hero"]').attributes('data-tone')).toBe('keep')
    expect(w.get('[data-ds="ring-bar"]').classes()).toContain('text-primary-t')
    expect(w.find('[data-ds="win-friend"]').exists()).toBe(false)
  })
})

describe('keyboard', () => {
  it('quiz option is a native button, so Enter and Space activate it', () => {
    const w = mount(DsQuizOption, { props: { letter: 'A' } })
    const btn = w.get('button')
    expect(btn.element.tagName).toBe('BUTTON')
    expect(btn.attributes('type')).toBe('button')
    expect(btn.attributes('tabindex')).toBeUndefined()
  })
  it('locked options carry aria-disabled', () => {
    for (const state of ['correct', 'wrong', 'dimmed'] as const) {
      const w = mount(DsQuizOption, { props: { letter: 'A', state } })
      expect(w.get('button').attributes('aria-disabled')).toBe('true')
    }
    expect(
      mount(DsQuizOption, { props: { letter: 'A' } })
        .get('button')
        .attributes('aria-disabled'),
    ).toBeUndefined()
  })

  const friends = [
    { value: 'aiman' as const, name: 'Aiman', trait: 'Tenang' },
    { value: 'aisyah' as const, name: 'Aisyah', trait: 'Ceria' },
  ]
  const mountPicker = () =>
    mount(DsFriendPicker, {
      props: {
        friends,
        title: 'Pilih',
        groupLabel: 'Rakan',
        confirmLabel: 'Pilih',
        cancelLabel: 'Batal',
        open: true,
        selected: 'aiman',
      },
      attachTo: document.body,
    })

  it('picker: arrow keys move the choice between radio cards', async () => {
    mountPicker()
    await wait(60)
    const radios = () => [...document.querySelectorAll<HTMLElement>('[role="radio"]')]
    expect(radios()[0]!.getAttribute('aria-checked')).toBe('true')
    radios()[0]!.focus()
    radios()[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await wait()
    expect(radios()[1]!.getAttribute('aria-checked')).toBe('true')
  })
  it('picker: Esc closes the sheet', async () => {
    const w = mountPicker()
    await wait(60)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    document
      .querySelector('[role="dialog"]')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await wait()
    expect(w.emitted('update:open')?.some((e) => e[0] === false)).toBe(true)
  })
  it('picker: the selected card is a tint, not a line', async () => {
    mountPicker()
    await wait(60)
    const item = document.querySelector('[role="radio"]')!.closest('[data-slot="item"]')!
    expect(item.className).toContain('border-0')
  })
  it('picker: the selected tick has a default screen-reader label', async () => {
    mountPicker()
    await wait(60)
    expect(document.querySelector('[data-ds="picker-tick"]')?.textContent).toContain('Dipilih')
  })
})

describe('no inline colour', () => {
  it('the whole gallery renders no inline style with a colour', async () => {
    mount(DsGalleryShowcase, { attachTo: document.body })
    await wait(50)
    const styled = [...document.querySelectorAll('[style]')].map(
      (e) => e.getAttribute('style') ?? '',
    )
    const colours = styled.filter((s) =>
      /color|background|gradient|#[0-9a-f]{3,8}|rgb|hsl|oklch/i.test(s),
    )
    expect(colours).toEqual([])
  })
})
