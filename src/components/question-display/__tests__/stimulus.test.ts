// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import StimulusFigure from '../StimulusFigure.vue'
import StimulusGroup from '../StimulusGroup.vue'
import type { StimulusData } from '../types'

const base = { id: 's1' }
const picture: StimulusData = {
  ...base,
  kind: 'image',
  src: '/x.png',
  width: 400,
  height: 200,
  alt: 'Litar bersiri',
  caption: 'Rajah 1 menunjukkan litar',
  title: 'Litar',
  text: 'Keterangan di bawah gambar.',
}

describe('StimulusFigure kinds', () => {
  it('passage: title, body paragraphs, source, no caption', () => {
    const w = mount(StimulusFigure, {
      props: {
        stimulus: { ...base, kind: 'passage', title: 'Merdeka', text: 'A.\n\nB.', source: 'Sumber: buku' },
      },
    })
    expect(w.find('[data-testid=stimulus-passage]').text()).toContain('Merdeka')
    expect(w.findAll('p').filter((p) => ['A.', 'B.'].includes(p.text()))).toHaveLength(2)
    expect(w.find('[data-testid=stimulus-source]').text()).toBe('Sumber: buku')
    expect(w.find('figcaption').exists()).toBe(false)
  })

  it.each(['image', 'infographic'] as const)(
    '%s: lazy picture with reserved ratio, alt, title, body, caption',
    (kind) => {
      const w = mount(StimulusFigure, { props: { stimulus: { ...picture, kind } } })
      const img = w.find('img')
      expect(img.attributes('loading')).toBe('lazy')
      expect(img.attributes('alt')).toBe('Litar bersiri')
      expect(img.attributes('width')).toBe('400')
      expect(img.attributes('height')).toBe('200')
      expect(w.find('[data-testid=stimulus-picture]').attributes('style')).toContain(
        'aspect-ratio: 400 / 200',
      )
      expect(w.find('[data-testid=stimulus-title]').text()).toBe('Litar')
      expect(w.text()).toContain('Keterangan di bawah gambar.')
      expect(w.find('figcaption').text()).toBe('Rajah 1 menunjukkan litar')
    },
  )

  it.each([
    ['diagram', 'Rajah'],
    ['map', 'Rajah'],
    ['graph', 'Graf'],
  ] as const)('%s: a stored picture with fallback caption %s', (kind, fallback) => {
    const w = mount(StimulusFigure, {
      props: { stimulus: { ...base, kind, src: '/api/files/tok', alt: 'Alt teks' } },
    })
    expect(w.find('img').attributes('src')).toBe('/api/files/tok')
    expect(w.find('figcaption').text()).toBe(fallback)
  })

  it('REQ-A-010: markup in an `svg` field is never rendered (no v-html, only pictures)', () => {
    const evil = '<svg onload="alert(1)"><script>alert(1)</script></svg>'
    const w = mount(StimulusFigure, {
      props: { stimulus: { ...base, kind: 'diagram', svg: evil, src: '/api/files/tok' } as never },
    })
    expect(w.html()).not.toContain('onload')
    expect(w.html()).not.toContain('<script')
    expect(w.find('[data-testid=stimulus-svg]').exists()).toBe(false)
    expect(w.find('img').attributes('src')).toBe('/api/files/tok')
  })

  it('map uses the picture; alt falls back to the caption fallback', () => {
    const w = mount(StimulusFigure, { props: { stimulus: { ...base, kind: 'map', src: '/m.png' } } })
    expect(w.find('img').attributes('alt')).toBe('Rajah')
  })

  it('table: real table with header, row headers and caption; scrolls in its own container', () => {
    const w = mount(StimulusFigure, {
      props: {
        stimulus: {
          ...base,
          kind: 'table',
          table: {
            head: ['Huruf', 'Tahun'],
            rows: [
              ['A', '1946'],
              ['B', '1948'],
            ],
            caption: 'Jadual 1',
          },
        },
      },
    })
    expect(w.findAll('thead th[scope=col]').map((t) => t.text())).toEqual(['Huruf', 'Tahun'])
    expect(w.findAll('tbody th[scope=row]').map((t) => t.text())).toEqual(['A', 'B'])
    expect(w.find('caption').text()).toBe('Jadual 1')
    expect(w.find('[data-testid=stimulus-table-scroll]').classes()).toContain('overflow-x-auto')
    expect(w.find('figcaption').exists()).toBe(false)
  })

  it('image-only table is a picture with the caption "Jadual"', () => {
    const w = mount(StimulusFigure, { props: { stimulus: { ...base, kind: 'table', src: '/t.png' } } })
    expect(w.find('table').exists()).toBe(false)
    expect(w.find('img').exists()).toBe(true)
    expect(w.find('figcaption').text()).toBe('Jadual')
  })

  it('shows the group label before the caption', () => {
    const w = mount(StimulusFigure, { props: { stimulus: { ...picture, label: 'Rajah 1' } } })
    expect(w.find('figcaption').text()).toBe('Rajah 1 · Rajah 1 menunjukkan litar')
  })
})

describe('StimulusFigure load failure (AC-07.4)', () => {
  it('shows the failure block, then retries and reports', async () => {
    const w = mount(StimulusFigure, { props: { stimulus: picture } })
    await w.find('img').trigger('error')
    const box = w.find('[data-testid=stimulus-failed]')
    expect(box.text()).toContain('Rajah tidak dapat dimuatkan.')
    expect(box.attributes('role')).toBe('alert')
    expect(w.find('img').exists()).toBe(false)
    expect(w.emitted('error')).toHaveLength(1)
    expect(w.find('[data-testid=stimulus-retry]').text()).toBe('Cuba lagi')
    expect(w.find('[data-testid=stimulus-report]').text()).toBe('Lapor')

    await w.find('[data-testid=stimulus-report]').trigger('click')
    expect(w.emitted('report')).toHaveLength(1)

    await w.find('[data-testid=stimulus-retry]').trigger('click')
    expect(w.emitted('retry')).toHaveLength(1)
    expect(w.find('img').exists()).toBe(true)
    expect(w.find('[data-testid=stimulus-failed]').exists()).toBe(false)
    await w.find('img').trigger('load')
    expect(w.emitted('loaded')).toHaveLength(1)
    expect(w.find('[data-testid=stimulus-picture]').attributes('data-status')).toBe('loaded')
  })

  it('keeps the reserved box while loading', () => {
    const w = mount(StimulusFigure, { props: { stimulus: picture } })
    expect(w.find('[data-testid=stimulus-picture]').attributes('data-status')).toBe('loading')
  })
})

const DrawerStub = defineComponent({
  props: { open: { type: Boolean, default: false }, title: { type: String, default: '' }, description: { type: String, default: '' } },
  emits: ['update:open'],
  setup(p, { slots, emit }) {
    return () =>
      h(
        'div',
        {
          'data-stub': 'drawer',
          'data-open': String(p.open),
          'data-title': p.title,
          'data-desc': p.description,
        },
        [
          p.open ? slots.body?.() : null,
          h('button', { 'data-testid': 'drawer-close', onClick: () => emit('update:open', false) }, 'Tutup'),
        ],
      )
  },
})

const mountGroup = async (wide: boolean, stimulus: StimulusData = { ...picture, label: 'Rajah 1' }) => {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: wide,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  const w = mount(StimulusGroup, {
    props: { stimulus },
    slots: { default: '<p data-testid="q">Soalan 1</p><p data-testid="q">Soalan 2</p>' },
    global: { stubs: { UDrawer: DrawerStub, Drawer: DrawerStub } },
  })
  await nextTick()
  return w
}

describe('StimulusGroup (D-3)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('from 1024px: one pinned pane with the stimulus rendered once, hint, questions beside it', async () => {
    const w = await mountGroup(true)
    expect(w.find('[data-layout=split]').exists()).toBe(true)
    expect(w.find('[data-testid=stimulus-chip]').exists()).toBe(false)
    expect(w.findAll('[data-testid=stimulus]')).toHaveLength(1)
    const pane = w.find('[data-testid=stimulus-pane]')
    expect(pane.classes()).toContain('sticky')
    expect(pane.classes().join(' ')).toContain('max-h-[calc(100vh-6rem)]')
    expect(pane.classes()).toContain('overflow-y-auto')
    expect(w.find('[data-testid=stimulus-hint]').text()).toBe('📌 Petikan kekal dipapar semasa menjawab')
    expect(w.findAll('[data-testid=q]')).toHaveLength(2)
    expect(w.find('[data-stub=drawer]').exists()).toBe(false)
  })

  it('below 1024px: chip "Lihat Rajah 1", no inline stimulus, sheet opens and closes', async () => {
    const w = await mountGroup(false)
    expect(w.find('[data-layout=stacked]').exists()).toBe(true)
    expect(w.find('[data-testid=stimulus-chip]').text()).toContain('Lihat Rajah 1')
    expect(w.find('[data-testid=stimulus-chip]').classes()).toContain('min-h-11')
    expect(w.findAll('[data-testid=stimulus]')).toHaveLength(0)
    const drawer = w.find('[data-stub=drawer]')
    expect(drawer.attributes('data-title')).toBe('Rajah 1')
    expect(drawer.attributes('data-desc')).toBe('Rajah kekal boleh dibuka semasa menjawab.')
    await w.find('[data-testid=stimulus-chip]').trigger('click')
    expect(w.find('[data-stub=drawer]').attributes('data-open')).toBe('true')
    expect(w.findAll('[data-testid=stimulus]')).toHaveLength(1)
    expect(w.findAll('[data-testid=q]')).toHaveLength(2)
    await w.find('[data-testid=drawer-close]').trigger('click')
    expect(w.find('[data-stub=drawer]').attributes('data-open')).toBe('false')
    expect(w.findAll('[data-testid=q]')).toHaveLength(2)
  })

  it('chip thumb: icon tile for a passage, picture for an image', async () => {
    const p = await mountGroup(false, { id: 'p', kind: 'passage', label: 'Petikan 1', text: 'Teks panjang.' })
    expect(p.find('[data-testid=stimulus-thumb-icon]').exists()).toBe(true)
    expect(p.find('[data-testid=stimulus-chip]').text()).toContain('Lihat Petikan 1')
    const i = await mountGroup(false)
    expect(i.find('[data-testid=stimulus-thumb-img]').attributes('src')).toBe('/x.png')
  })
})
