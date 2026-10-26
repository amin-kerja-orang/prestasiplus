// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import ProfileAvatarCard from '../../components/profile/ProfileAvatarCard.vue'

beforeEach(() => setActivePinia(createPinia()))

describe('ProfileAvatarCard (S8 picture)', () => {
  it('the choose button has the visible, accessible name "Pilih Gambar"', async () => {
    const w = mount(ProfileAvatarCard, { props: { name: 'Pelajar Demo', avatarUrl: null } })
    await flushPromises()
    const button = w.get('[data-testid=picture-form] button')
    expect(button.attributes('data-testid')).toBe('picture-choose')
    expect(button.text()).toBe('Pilih Gambar')
    expect(w.find('[data-testid=picture-save]').exists()).toBe(false)
    expect(w.get('input[type=file]').attributes('accept')).toBe('image/jpeg,image/png,image/webp')
  })
})
