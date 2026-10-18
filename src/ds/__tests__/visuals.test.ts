// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import {
  DsArt3D,
  DsCharacterCard,
  DsEmptyState,
  DsFloatScore,
  DsFriendAvatar,
  DsIconChip,
  DsLiveBadge,
  DsLiveTiles,
  DsScoreRing,
  DsSpeechBubble,
  DsStatTile,
  DsSticker,
  DsThemeScope,
  DsWinHero,
  art3dNames,
} from '@/ds'

describe('DsIconChip', () => {
  it('is decorative and uses the solid accent fill with a staff glyph variant', () => {
    const w = mount(DsIconChip, { props: { icon: 'i-ph-fire-duotone', accent: 'heat' } })
    expect(w.attributes('aria-hidden')).toBe('true')
    expect(w.classes()).toContain('bg-heat')
    expect(w.classes()).toContain('text-on-highlight')
    expect(w.classes()).toContain('staff:text-primary-on')
  })
  it('has size variants', () => {
    const w = mount(DsIconChip, { props: { icon: 'i-ph-star', size: 'lg' } })
    expect(w.classes()).toContain('size-10')
  })
})

describe('DsArt3D', () => {
  it('ships a bundled local asset for every name', () => {
    for (const name of art3dNames) {
      const w = mount(DsArt3D, { props: { name } })
      const src = w.get('img').attributes('src') ?? ''
      expect(src).not.toMatch(/^(https?:)?\/\//)
      expect(src.length).toBeGreaterThan(0)
    }
  })
  it('is decorative by default, named when a label is given', () => {
    const deco = mount(DsArt3D, { props: { name: 'fire' } })
    expect(deco.get('img').attributes('alt')).toBe('')
    expect(deco.get('img').attributes('aria-hidden')).toBe('true')
    const named = mount(DsArt3D, { props: { name: 'fire', label: 'Streak' } })
    expect(named.get('img').attributes('alt')).toBe('Streak')
    expect(named.get('img').attributes('aria-hidden')).toBeUndefined()
  })
  it('float animation respects reduced motion', () => {
    const w = mount(DsArt3D, { props: { name: 'coin', float: true } })
    expect(w.get('img').classes()).toContain('animate-ds-bob')
    expect(w.get('img').classes()).toContain('motion-reduce:animate-none')
  })
})

describe('DsStatTile', () => {
  it('shows value and unit with an icon chip', () => {
    const w = mount(DsStatTile, { props: { value: 12, unit: 'hari', icon: 'i-ph-fire' } })
    expect(w.text()).toContain('12')
    expect(w.text()).toContain('hari')
    expect(w.find('[data-ds="icon-chip"]').exists()).toBe(true)
    expect(w.classes()).toContain('motion-reduce:animate-none')
  })
  it('swaps the chip for 3D art', () => {
    const w = mount(DsStatTile, { props: { value: 1, unit: 'koin', art: 'coin' } })
    expect(w.find('[data-ds="icon-chip"]').exists()).toBe(false)
    expect(w.find('img[data-art="coin"]').exists()).toBe(true)
  })
})

describe('DsCharacterCard', () => {
  it.each([
    ['trial', 'bg-trial'],
    ['warning', 'bg-heat'],
    ['info', 'bg-friend'],
    ['win', 'bg-highlight'],
    ['action', 'bg-primary'],
  ] as const)('variant %s uses its accent', (variant, cls) => {
    const w = mount(DsCharacterCard, {
      props: { variant, title: 'Tajuk', description: 'Teks', icon: 'i-ph-star', ctaLabel: 'Pergi' },
    })
    expect(w.attributes('data-variant')).toBe(variant)
    expect(w.html()).toContain(cls)
    expect(w.text()).toContain('Tajuk')
  })
  it('emits cta and can show 3D art', async () => {
    const w = mount(DsCharacterCard, { props: { title: 'T', art: 'trophy', ctaLabel: 'Pergi' } })
    expect(w.find('img[data-art="trophy"]').exists()).toBe(true)
    await w.get('[data-ds="card-cta"]').trigger('click')
    expect(w.emitted('cta')).toHaveLength(1)
  })
  it('hides the CTA when no label is given', () => {
    const w = mount(DsCharacterCard, { props: { title: 'T' } })
    expect(w.find('[data-ds="card-cta"]').exists()).toBe(false)
  })
})

describe('DsFriendAvatar', () => {
  it('is decorative when not interactive and shows a mood badge', () => {
    const w = mount(DsFriendAvatar, { props: { friend: 'aiman', mood: 'happy' } })
    expect(w.find('button').exists()).toBe(false)
    expect(w.find('[data-ds="mood-badge"]').text()).toBe('😊')
    expect(w.find('[data-ds="mood-badge"]').attributes('aria-hidden')).toBe('true')
  })
  it('neutral has no badge', () => {
    const w = mount(DsFriendAvatar, { props: { friend: 'aisyah' } })
    expect(w.find('[data-ds="mood-badge"]').exists()).toBe(false)
  })
  it('interactive is a named button that emits press', async () => {
    const w = mount(DsFriendAvatar, {
      props: {
        friend: 'aisyah',
        interactive: true,
        label: 'Tukar rakan belajar. Rakan sekarang: Aisyah',
      },
    })
    const btn = w.get('button')
    expect(btn.attributes('aria-label')).toBe('Tukar rakan belajar. Rakan sekarang: Aisyah')
    expect(btn.classes()).toContain('min-h-14')
    await btn.trigger('click')
    expect(w.emitted('press')).toHaveLength(1)
  })
  it('moods map to motion and respect reduced motion', () => {
    const w = mount(DsFriendAvatar, { props: { friend: 'aiman', mood: 'celebrating' } })
    expect(w.html()).toContain('animate-ds-party')
    expect(w.html()).toContain('motion-reduce:animate-none')
    const still = mount(DsFriendAvatar, { props: { friend: 'aiman', animated: false } })
    expect(still.html()).not.toContain('animate-ds-bob')
  })
})

describe('DsSpeechBubble', () => {
  it('shows name and content', () => {
    const w = mount(DsSpeechBubble, { props: { name: 'Aiman' }, slots: { default: 'Jom?' } })
    expect(w.text()).toContain('Aiman')
    expect(w.text()).toContain('Jom?')
    expect(w.attributes('role')).toBeUndefined()
  })
  it('typing state shows dots and a screen-reader label instead of content', () => {
    const w = mount(DsSpeechBubble, {
      props: { typing: true, typingLabel: 'Sedang menaip', live: true },
      slots: { default: 'Jom?' },
    })
    expect(w.find('[data-ds="typing-dots"]').exists()).toBe(true)
    expect(w.find('[data-ds="typing-dots"]').attributes('aria-hidden')).toBe('true')
    expect(w.text()).toContain('Sedang menaip')
    expect(w.text()).not.toContain('Jom?')
    expect(w.attributes('role')).toBe('status')
    expect(w.html()).toContain('motion-reduce:animate-none')
  })
})

describe('DsScoreRing', () => {
  it('is a labelled meter and computes the bar offset', () => {
    const w = mount(DsScoreRing, {
      props: { value: 5, max: 10, label: 'Skor 5 daripada 10', unit: 'daripada 10' },
    })
    expect(w.attributes('role')).toBe('meter')
    expect(w.attributes('aria-label')).toBe('Skor 5 daripada 10')
    expect(w.attributes('aria-valuenow')).toBe('5')
    expect(w.attributes('aria-valuemax')).toBe('10')
    const c = 2 * Math.PI * 44
    const offset = Number(w.get('[data-ds="ring-bar"]').attributes('stroke-dashoffset'))
    expect(offset).toBeCloseTo(c / 2, 3)
    expect(w.text()).toContain('daripada 10')
  })
  it('clamps out-of-range values and honours tone and display', () => {
    const w = mount(DsScoreRing, {
      props: { value: 99, max: 5, label: 'x', tone: 'win', display: '5/5' },
    })
    expect(w.attributes('aria-valuenow')).toBe('5')
    expect(Number(w.get('[data-ds="ring-bar"]').attributes('stroke-dashoffset'))).toBeCloseTo(0, 5)
    expect(w.get('[data-ds="ring-bar"]').classes()).toContain('text-win-ring')
    expect(w.text()).toContain('5/5')
    expect(w.html()).toContain('motion-reduce:transition-none')
  })
})

describe('DsWinHero, DsSticker, DsFloatScore', () => {
  it('hero has a focusable heading and a tone', () => {
    const w = mount(DsWinHero, {
      props: { art: 'party', title: 'Sempurna!', subtitle: 'Hebat', tone: 'keep' },
    })
    const h = w.get('h2')
    expect(h.attributes('tabindex')).toBe('-1')
    expect(h.text()).toBe('Sempurna!')
    expect(w.attributes('data-tone')).toBe('keep')
    expect(w.find('img[data-art="party"]').exists()).toBe(true)
  })
  it('sticker stamps in with reduced-motion fallback', () => {
    const w = mount(DsSticker, { props: { art: 'fire' }, slots: { default: 'Streak 5 hari!' } })
    expect(w.text()).toContain('Streak 5 hari!')
    expect(w.classes()).toContain('animate-ds-stamp')
    expect(w.classes()).toContain('motion-reduce:animate-none')
  })
  it('float score is decorative', () => {
    const w = mount(DsFloatScore, { props: { text: '+10' } })
    expect(w.text()).toBe('+10')
    expect(w.attributes('aria-hidden')).toBe('true')
    expect(w.classes()).toContain('motion-reduce:animate-none')
  })
})

describe('DsLiveBadge, DsLiveTiles, DsEmptyState, DsThemeScope', () => {
  it('live badge pulses its dot only and stays labelled', () => {
    const w = mount(DsLiveBadge, { props: { label: 'LANGSUNG' } })
    expect(w.text()).toContain('LANGSUNG')
    expect(w.html()).toContain('animate-ds-live-pulse')
    expect(w.html()).toContain('motion-reduce:animate-none')
  })
  it('live tiles render a named group with one tile per item', () => {
    const w = mount(DsLiveTiles, {
      props: {
        label: 'Aktiviti langsung',
        liveLabel: 'LANGSUNG',
        tiles: [
          { id: 'a', value: 1, unit: 'satu', icon: 'i-ph-users' },
          { id: 'b', value: 2, unit: 'dua', icon: 'i-ph-users' },
        ],
      },
    })
    expect(w.attributes('aria-label')).toBe('Aktiviti langsung')
    expect(w.findAll('[data-ds="stat-tile"]')).toHaveLength(2)
    expect(w.text()).toContain('LANGSUNG')
  })
  it('empty state shows copy, actions and optionally the friend', () => {
    const w = mount(DsEmptyState, {
      props: { title: 'Tiada rekod', description: 'Cuba lagi', friend: 'aisyah' },
      slots: { actions: '<span data-test="act">Mula</span>' },
    })
    expect(w.text()).toContain('Tiada rekod')
    expect(w.find('[data-ds="friend-face"]').exists()).toBe(true)
    expect(w.find('[data-test="act"]').exists()).toBe(true)
  })
  it('theme scope sets personality and a light / dark marker', () => {
    const dark = mount(DsThemeScope, { props: { personality: 'learner', scheme: 'dark' } })
    expect(dark.attributes('data-personality')).toBe('learner')
    expect(dark.classes()).toContain('dark')
    const light = mount(DsThemeScope, { props: { personality: 'staff', scheme: 'light' } })
    expect(light.classes()).toContain('light')
    expect(light.classes()).not.toContain('dark')
  })
})
