// @vitest-environment jsdom
// S8-T02 part 4: leaf stimulus + "Bahan 2" / "semua bahan" links (FR-PA-37, AC-PA-39).
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import { citeSegments } from '../lib/rich-text'
import { resetStimulusOpen } from '../lib/useStimulusOpen'
import PartNode from '../PartNode.vue'
import StimulusGroup from '../StimulusGroup.vue'
import type { StimulusData } from '../types'

const st = (n: number): StimulusData => ({ id: `qb-s${n}`, kind: 'passage', label: `Bahan ${n}`, text: `Teks ${n}` })
const stimuli = [st(1), st(2), st(3)]

const DrawerStub = defineComponent({
  props: { open: { type: Boolean, default: false } },
  emits: ['update:open'],
  setup: (p, { slots }) => () => h('div', { 'data-open': String(p.open) }, p.open ? (slots.body?.() ?? []) : []),
})
const media = (wide: boolean, roomy = wide) => {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: q.includes('1024') ? wide : roomy,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}
const part = (prompt: string, extra: Record<string, unknown> = {}) => ({
  id: 'p1', label: '(a)', prompt, marks: 2, answer: { kind: 'short_text' as const }, ...extra,
})
const own: StimulusData = { id: 'own-1', kind: 'passage', label: 'Petikan Z', text: 'Teks sendiri' }
const host = (p: unknown) =>
  defineComponent({
    setup: () => () =>
      h(StimulusGroup, { stimuli, split: 'sitting' }, () =>
        h(PartNode, { part: p as never, answers: {}, attemptId: 'a1', stimuli: [...stimuli, own] }),
      ),
  })
const go = async (wide: boolean, p: unknown, roomy = wide) => {
  media(wide, roomy)
  const w = mount(host(p), { global: { stubs: { UDrawer: DrawerStub, Drawer: DrawerStub } }, attachTo: document.body })
  await nextTick()
  return w
}

enableAutoUnmount(afterEach)
beforeEach(() => resetStimulusOpen())

describe('citeSegments', () => {
  it('AC-PA-39: case-insensitive, whole-word, no match stays plain', () => {
    expect(citeSegments('Lihat bahan 2 dan Bahan 21', stimuli)).toEqual([
      { kind: 'text', text: 'Lihat ' },
      { kind: 'cite', text: 'bahan 2', target: 'qb-s2' },
      { kind: 'text', text: ' dan Bahan 21' },
    ])
    expect(citeSegments('Tiada rujukan', stimuli)).toEqual([{ kind: 'text', text: 'Tiada rujukan' }])
    expect(citeSegments('Semua Bahan', stimuli)).toEqual([{ kind: 'cite', text: 'Semua Bahan', target: 'all' }])
  })
})

describe('PartNode links', () => {
  it('AC-PA-39: "Bahan 2" renders a button that opens Bahan 2', async () => {
    const w = await go(true, part('Berdasarkan Bahan 2, jelaskan.'))
    const b = w.findAll('[data-testid="cite-link"]')
    expect(b).toHaveLength(1)
    expect(b[0]!.element.tagName).toBe('BUTTON')
    await b[0]!.trigger('click')
    expect(w.find('[data-stimulus-id="qb-s2"]').attributes('data-stimulus-lit')).toBe('true')
    expect(w.find('[data-stimulus-id="qb-s1"]').attributes('data-stimulus-lit')).toBeUndefined()
  })
  it('AC-PA-39: "semua bahan" opens all (3 shown) in the drawer', async () => {
    const w = await go(false, part('Bandingkan semua bahan.'))
    expect(w.find('[data-open]').attributes('data-open')).toBe('false')
    await w.find('[data-testid="cite-link"]').trigger('click')
    await nextTick()
    expect(w.find('[data-open]').attributes('data-open')).toBe('true')
    expect(w.findAll('[data-testid="group-stimuli"] [data-stimulus-id]')).toHaveLength(3)
    expect(w.findAll('[data-stimulus-lit="true"]')).toHaveLength(3)
  })
  it('AC-PA-39: no match stays plain; "Bahan 21" does not match "Bahan 2"', async () => {
    const w = await go(true, part('Lihat Bahan 21 sahaja.'))
    expect(w.find('[data-testid="cite-link"]').exists()).toBe(false)
  })
  it('AC-PA-39: KaTeX still renders with a citation present', async () => {
    const w = await go(true, part('Dalam Bahan 1, kira $x^2$.'))
    expect(w.find('[data-testid="cite-link"]').exists()).toBe(true)
    expect(w.find('.katex').exists()).toBe(true)
  })
})

describe('leaf stimulus', () => {
  it('FR-PA-37: collapsed behind "Lihat {label}" at 375', async () => {
    const w = await go(false, part('Soalan.', { stimulusId: 'own-1' }), false)
    // The 375 / 768 switch is CSS (states.css keys on data-leaf-stim and data-leaf-toggle); jsdom checks those hooks.
    const t = w.find('[data-testid="leaf-stimulus-toggle"]')
    expect(t.text()).toBe('Lihat Petikan Z')
    expect(t.attributes('data-leaf-toggle')).toBeDefined()
    expect(t.attributes('aria-expanded')).toBe('false')
    expect(w.find('[data-leaf-stim]').attributes('data-leaf-stim')).toBe('closed')
    await t.trigger('click')
    expect(w.find('[data-leaf-stim]').attributes('data-leaf-stim')).toBe('open')
    expect(t.attributes('aria-expanded')).toBe('true')
  })
  it('FR-PA-37: the stimulus sits in the leaf, inline from 768 (toggle hidden by CSS)', async () => {
    const w = await go(false, part('Soalan.', { stimulusId: 'own-1' }), true)
    expect(w.find('[data-leaf-stim] [data-testid="leaf-stimulus"]').text()).toContain('Teks sendiri')
  })
  it('FR-PA-37: a leaf whose stimulus is in the group panel only links to it, no second figure', async () => {
    const w = await go(true, part('Soalan.', { stimulusId: 'qb-s3' }))
    const l = w.find('[data-testid="leaf-stimulus-link"]')
    expect(l.text()).toBe('Lihat Bahan 3')
    expect(w.find('[data-testid="leaf-stimulus"]').exists()).toBe(false)
    expect(w.find('[data-testid="stimulus-questions"] [data-stimulus-id]').exists()).toBe(false)
    await l.trigger('click')
    expect(w.find('[data-stimulus-id="qb-s3"]').attributes('data-stimulus-lit')).toBe('true')
  })
  it('FR-PA-37: a leaf without stimulusId is unchanged', async () => {
    const w = await go(true, part('Soalan.'))
    expect(w.find('[data-testid="leaf-stimulus"]').exists()).toBe(false)
    expect(w.find('[data-testid="leaf-stimulus-toggle"]').exists()).toBe(false)
  })
})

describe('two groups on one page', () => {
  it('AC-PA-39: a cite in group 2 highlights only group 2 stimulus', async () => {
    media(true)
    const pair = (gid: string) =>
      h(StimulusGroup, { stimuli, split: 'sitting', groupId: gid }, () =>
        h(PartNode, { part: part('Lihat Bahan 2.'), answers: {}, attemptId: gid, stimuli }),
      )
    const w = mount(defineComponent({ setup: () => () => h('div', [pair('g1'), pair('g2')]) }), {
      global: { stubs: { UDrawer: DrawerStub, Drawer: DrawerStub } },
      attachTo: document.body,
    })
    await nextTick()
    const groups = w.findAll('[data-testid="stimulus-group"]')
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    await groups[1]!.find('[data-testid="cite-link"]').trigger('click')
    await nextTick()
    expect(groups[0]!.findAll('[data-stimulus-lit="true"]')).toHaveLength(0)
    expect(groups[1]!.findAll('[data-stimulus-lit="true"]')).toHaveLength(1)
    expect(scroll).toHaveBeenCalledTimes(1)
    expect(scroll.mock.contexts[0]).toBe(groups[1]!.find('[data-stimulus-id="qb-s2"]').element)
  })
})
