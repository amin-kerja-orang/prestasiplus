// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'

import ParentInviteAcceptPage from '../../pages/ParentInviteAcceptPage.vue'

const m02 = vi.hoisted(() => ({ fetchInvitePreview: vi.fn(), acceptParentInvite: vi.fn() }))
vi.mock('@/modules/m02-users-schools', () => m02)

type Viewer = 'guest' | 'parent' | 'other'

function preview(viewer: Viewer, schoolName: string | null = 'SMK DEMO') {
  return {
    valid: true,
    student: { name: 'Pelajar Demo', initials: 'PD', schoolName },
    viewer,
  }
}

const notFound = () => new ApiError({ status: 404, code: 'NOT_FOUND', message: 'HTTP 404' })

let wrapper: VueWrapper | null = null
let router: Router
const t = (id: string) => wrapper!.get(`[data-testid=${id}]`)
const has = (id: string) => wrapper!.find(`[data-testid=${id}]`).exists()

async function render(token = 'a'.repeat(64)): Promise<void> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:rest(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/')
  wrapper = mount(ParentInviteAcceptPage, {
    props: { token },
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  m02.fetchInvitePreview.mockReset()
  m02.acceptParentInvite.mockReset()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('invalid token (FR-L45-19, OBSERVED copy)', () => {
  it.each(['0000', 'zzzz', '0'.repeat(64)])('shows "Link Tidak Sah" for %s', async (token) => {
    m02.fetchInvitePreview.mockRejectedValue(notFound())
    await render(token)
    expect(m02.fetchInvitePreview).toHaveBeenCalledWith(token)
    expect(t('invite-invalid').find('h1').text()).toBe('Link Tidak Sah')
    expect(t('invite-invalid').text()).toContain(
      'Link jemputan ini tidak sah atau telah tamat tempoh.',
    )
    expect(t('invite-invalid-info').text()).toBe(
      'Link ini mungkin telah tamat tempoh atau dibatalkan. Sila minta anak anda menghantar jemputan baharu.',
    )
    expect(t('invite-invalid-login').text()).toBe('Log Masuk')
    expect(t('invite-invalid-login').attributes('href')).toBe('/login')
    expect(t('invite-invalid-home').text()).toBe('Laman Utama')
    expect(t('invite-invalid-home').attributes('href')).toBe('/')
    expect(t('invite-invalid-footer').text()).toBe(
      'PRESTASIPLUS — Platform Latih Tubi Interaktif Malaysia',
    )
    expect(document.title).toBe('Link Tidak Sah — PRESTASIPLUS')
    expect(m02.acceptParentInvite).not.toHaveBeenCalled()
  })

  it('shows the error state with "Cuba lagi" on a server error', async () => {
    m02.fetchInvitePreview.mockRejectedValueOnce(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'HTTP 500' }),
    )
    await render()
    expect(t('invite-error').text()).toContain('Ralat berlaku. Sila cuba lagi.')
    m02.fetchInvitePreview.mockResolvedValue(preview('guest'))
    await t('invite-retry').trigger('click')
    await flushPromises()
    expect(has('invite-guest-text')).toBe(true)
  })
})

describe('token prop change', () => {
  it('reloads the preview for the new token and leaves the invalid page', async () => {
    m02.fetchInvitePreview.mockRejectedValueOnce(notFound())
    await render('old')
    expect(has('invite-invalid')).toBe(true)
    m02.fetchInvitePreview.mockResolvedValue(preview('guest'))
    await wrapper!.setProps({ token: 'new' })
    await flushPromises()
    expect(m02.fetchInvitePreview).toHaveBeenLastCalledWith('new')
    expect(has('invite-invalid')).toBe(false)
    expect(t('invite-heading').text()).toContain('Pelajar Demo')
  })
})

describe('guest (FR-L45-22..25)', () => {
  it('shows the identity card, login CTA, register note and caption; never links', async () => {
    m02.fetchInvitePreview.mockResolvedValue(preview('guest'))
    await render()
    expect(t('invite-initials').text()).toBe('PD')
    expect(t('invite-eyebrow').text()).toBe('Jemputan Ibu Bapa')
    expect(t('invite-heading').text()).toBe('Anda dijemput untuk memantau kemajuan Pelajar Demo')
    expect(t('invite-school').text()).toBe('SMK DEMO')
    expect(t('invite-guest-text').text()).toBe(
      'Untuk memantau kemajuan pembelajaran anak anda di PRESTASIPLUS, sila log masuk menggunakan akaun Ibu Bapa anda. Selepas log masuk, buka semula pautan jemputan ini untuk mengesahkan hubungan.',
    )
    expect(t('invite-login').text()).toBe('Log Masuk Sebagai Ibu Bapa')
    expect(t('invite-login').attributes('href')).toBe('/login')
    expect(t('invite-register-note').text().replace(/\s+/g, ' ')).toBe(
      'Belum mempunyai akaun Ibu Bapa? Daftar akaun Ibu Bapa terlebih dahulu, kemudian buka semula pautan jemputan ini.',
    )
    expect(t('invite-register-link').attributes('href')).toBe('/register')
    // DV-30: inline link; vertical padding gives a >= 44 px tap target (20 px line + 2 x 12 px)
    expect(t('invite-register-link').classes()).toContain('py-3')
    expect(t('invite-caption').text()).toBe(
      'Pautan jemputan ini dikongsi oleh Pelajar Demo melalui PRESTASIPLUS.',
    )
    expect(t('invite-back').attributes('href')).toBe('/')
    expect(document.title).toBe('Jemputan Ibu Bapa — PRESTASIPLUS')
    expect(m02.acceptParentInvite).not.toHaveBeenCalled()
  })

  it('omits the school line when the student has no school', async () => {
    m02.fetchInvitePreview.mockResolvedValue(preview('guest', null))
    await render()
    expect(has('invite-school')).toBe(false)
  })
})

describe('non-parent (FR-L45-26)', () => {
  it('shows the switch-account text and logs out to /login', async () => {
    m02.fetchInvitePreview.mockResolvedValue(preview('other'))
    await render()
    expect(t('invite-other-text').text()).toBe(
      'Anda kini log masuk sebagai akaun yang bukan Ibu Bapa. Untuk berhubung dengan pelajar ini, sila log keluar dan log masuk semula menggunakan akaun Ibu Bapa anda.',
    )
    expect(t('invite-other-text').get('strong').text()).toBe('bukan Ibu Bapa')
    expect(t('invite-switch').text()).toBe('Log Keluar & Log Masuk Sebagai Ibu Bapa')
    const push = vi.spyOn(router, 'push')
    await t('invite-switch').trigger('click')
    expect(push).toHaveBeenCalledWith('/logout')
    expect(m02.acceptParentInvite).not.toHaveBeenCalled()
  })
})

describe('parent (FR-L45-27..29)', () => {
  it('accepts once and shows the linked state', async () => {
    m02.fetchInvitePreview.mockResolvedValue(preview('parent'))
    m02.acceptParentInvite.mockResolvedValue({
      linked: true,
      created: true,
      student: { id: 3, name: 'Pelajar Demo', schoolName: 'SMK DEMO' },
      parent: { name: 'Ibu Bapa Demo' },
    })
    await render('tok')
    expect(m02.acceptParentInvite).toHaveBeenCalledTimes(1)
    expect(m02.acceptParentInvite).toHaveBeenCalledWith('tok')
    expect(t('invite-eyebrow').text()).toBe('Berjaya Berhubung')
    expect(t('invite-heading').text()).toBe('Anda kini berhubung dengan Pelajar Demo')
    expect(t('invite-linked-box').text()).toBe(
      'Akaun anda (Ibu Bapa Demo) telah dihubungkan dengan pelajar ini. Anda kini boleh memantau kemajuan mereka.',
    )
    expect(t('invite-profile-link').text()).toBe('Lihat Profil Kemajuan')
    expect(t('invite-profile-link').attributes('href')).toBe('/pelajar/3')
  })

  it('shows the spinner while accepting', async () => {
    m02.fetchInvitePreview.mockResolvedValue(preview('parent'))
    m02.acceptParentInvite.mockReturnValue(new Promise(() => {}))
    await render()
    expect(has('invite-accepting')).toBe(true)
    expect(has('invite-linked-box')).toBe(false)
  })

  it('keeps the valid card and shows the red alert when accepting fails', async () => {
    m02.fetchInvitePreview.mockResolvedValue(preview('parent'))
    m02.acceptParentInvite.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'HTTP 500' }),
    )
    await render()
    expect(t('invite-accept-alert').text()).toContain('Ralat berlaku. Sila cuba lagi.')
    expect(t('invite-eyebrow').text()).toBe('Jemputan Ibu Bapa')
    expect(has('invite-linked-box')).toBe(false)
  })

  it('falls to the invalid page when accept finds the token gone (404)', async () => {
    m02.fetchInvitePreview.mockResolvedValue(preview('parent'))
    m02.acceptParentInvite.mockRejectedValue(notFound())
    await render()
    expect(has('invite-invalid')).toBe(true)
  })
})
