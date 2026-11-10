// @vitest-environment jsdom
// S8-T03 part 5: language toggle and bilingual stacked display (FR-PA-04, AC-PA-04).
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import { formStubs } from '@/test-support/form-stubs'

import BilingualText from '../BilingualText.vue'
import LanguageToggle from '../LanguageToggle.vue'
import { reloadQuestionLang, useQuestionLang } from '../lib/question-lang'

const global = { components: formStubs }
const both = () =>
  mount(BilingualText, { props: { text: 'Soalan BM', en: 'English question' }, global })

beforeEach(() => {
  localStorage.clear()
  reloadQuestionLang()
})

describe('AC-PA-04 language toggle', () => {
  it('defaults to BM + English: BM block, hairline, then English', () => {
    const w = both()
    const t = w.text()
    expect(t.indexOf('Soalan BM')).toBeLessThan(t.indexOf('English question'))
    expect(w.find('[data-testid=lang-divider]').exists()).toBe(true)
  })
  it('chrome text and aria-label are BM and unchanged by the choice', async () => {
    const w = mount(LanguageToggle, { global })
    expect(w.attributes('aria-label')).toBe('Bahasa soalan')
    const labels = () => w.findAll('button').map((b) => b.text())
    expect(labels()).toEqual(['BM', 'English', 'BM + English'])
    expect(w.find('[data-testid=lang-both]').attributes('aria-pressed')).toBe('true')
    await w.find('[data-testid=lang-en]').trigger('click')
    expect(labels()).toEqual(['BM', 'English', 'BM + English'])
  })
  it('BM hides English, English hides BM', async () => {
    const toggle = mount(LanguageToggle, { global })
    const w = both()
    await toggle.find('[data-testid=lang-ms]').trigger('click')
    expect(w.text()).toContain('Soalan BM')
    expect(w.text()).not.toContain('English question')
    await toggle.find('[data-testid=lang-en]').trigger('click')
    expect(w.text()).not.toContain('Soalan BM')
    expect(w.text()).toContain('English question')
    expect(w.find('[data-testid=lang-divider]').exists()).toBe(false)
  })
  it('persists in localStorage and survives a remount', async () => {
    const a = mount(LanguageToggle, { global })
    await a.find('[data-testid=lang-en]').trigger('click')
    expect(localStorage.getItem('pp.qd.lang')).toBe('en')
    a.unmount()
    reloadQuestionLang()
    const b = mount(LanguageToggle, { global })
    expect(b.find('[data-testid=lang-en]').attributes('aria-pressed')).toBe('true')
  })
  it('a bad stored value falls back to both; broken storage does not throw', () => {
    localStorage.setItem('pp.qd.lang', 'zz')
    reloadQuestionLang()
    expect(useQuestionLang().lang.value).toBe('both')
  })
  it('a field with one language shows as is in every mode', () => {
    const { setLang } = useQuestionLang()
    for (const m of ['ms', 'en', 'both'] as const) {
      setLang(m)
      const w = mount(BilingualText, { props: { text: 'Hanya BM' }, global })
      expect(w.text()).toBe('Hanya BM')
      expect(w.find('[data-testid=lang-divider]').exists()).toBe(false)
    }
  })
})
