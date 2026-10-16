// @vitest-environment jsdom
// Own file: Nuxt UI's `useLocale` is a shared composable that reads the injected locale once, so
// this must be the first Nuxt UI component mounted in its worker (as the app is, at boot).
/* eslint-disable @typescript-eslint/unbound-method -- jsdom polyfill checks */
import { mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'

import { ms } from '@nuxt/ui/locale'

import { DsCarousel } from '@/ds'
import { uiLocale, uiLocaleKey } from '@/theme/locale-ms'

const wait = (t = 30) => new Promise((r) => setTimeout(r, t))

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
})

describe('Nuxt UI locale (app-level provide)', () => {
  it('carousel labels are Bahasa Melayu: one tab per slide, each named', async () => {
    const w = mount(DsCarousel, {
      props: { items: [{ t: 'Satu' }, { t: 'Dua' }, { t: 'Tiga' }], label: 'Petua' },
      slots: { item: '<template #item="{ item }"><p>{{ item.t }}</p></template>' },
      global: { provide: { [uiLocaleKey]: uiLocale } },
    })
    await wait()
    expect(w.get('[role="tablist"]').attributes('aria-label')).toBe(ms.messages.carousel.dots)
    expect(w.get('[role="tablist"]').attributes('aria-label')).toBe('Pilih slaid untuk dipaparkan')
    const dots = w.findAll('[role="tab"]')
    // jsdom has no layout, so Embla reports a single snap; the labels are what matter here.
    expect(dots.length).toBeGreaterThanOrEqual(1)
    expect(dots[0]!.attributes('aria-label')).toBe('Pergi ke slaid 1')
    expect(dots[0]!.attributes('aria-selected')).toBe('true')
    await wait()
    expect(
      w.get('[role="region"], [aria-roledescription]').attributes('aria-roledescription'),
    ).toBe(ms.messages.carousel.roledescription)
  })
})
