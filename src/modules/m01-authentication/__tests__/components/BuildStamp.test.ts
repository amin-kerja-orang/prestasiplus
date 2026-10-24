// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import BuildStamp from '../../components/auth/BuildStamp.vue'

describe('BuildStamp (UAT T0)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('renders nothing outside the demo build mode (tests, e2e, dev)', () => {
    const wrapper = mount(BuildStamp)
    expect(wrapper.find('[data-testid="build-stamp"]').exists()).toBe(false)
  })

  it('shows "Binaan <sha> · <date>" in the demo build mode', async () => {
    vi.stubEnv('MODE', 'demo')
    vi.resetModules()
    const { default: Stamp } = await import('../../components/auth/BuildStamp.vue')
    const text = mount(Stamp).get('[data-testid="build-stamp"]').text()
    expect(text).toMatch(/^Binaan \S+ · \d{4}-\d{2}-\d{2}$/)
  })
})
