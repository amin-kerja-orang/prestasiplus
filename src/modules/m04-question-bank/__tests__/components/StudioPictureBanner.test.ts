// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import StudioPictureBanner from '../../components/studio/StudioPictureBanner.vue'

const TEXT = 'Gambar soalan ini tiada. Sila muat naik semula.'

describe('StudioPictureBanner (KP-15)', () => {
  it('shows the notice for a held picture', () => {
    const w = mount(StudioPictureBanner, { props: { imageHeld: true, flags: [] } })
    expect(w.get('[data-testid="studio-picture-missing"]').text()).toContain(TEXT)
  })
  it('shows the notice for an open stimulus_missing flag', () => {
    const w = mount(StudioPictureBanner, { props: { flags: ['stimulus_missing'] } })
    expect(w.find('[data-testid="studio-picture-missing"]').exists()).toBe(true)
  })
  it('shows nothing for another flag or none', () => {
    expect(mount(StudioPictureBanner, { props: { flags: ['stem_duplicated', 'figure_only'] } }).find('[data-testid="studio-picture-missing"]').exists()).toBe(false)
    expect(mount(StudioPictureBanner, { props: {} }).find('[data-testid="studio-picture-missing"]').exists()).toBe(false)
  })
})
