// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useFlashStore } from '@/stores/flash'

import type { AdminUserPackages } from '../../api/users'
import UserPackagesPage from '../../pages/UserPackagesPage.vue'

const api = vi.hoisted(() => ({ fetchUserPackages: vi.fn(), assignUserPackage: vi.fn() }))
vi.mock('../../api/users', () => api)

function payload(t4: number | null = null): AdminUserPackages {
  return {
    user: { id: 5601, name: 'Admin Contoh' },
    school: {
      id: 8102,
      name: 'SEKOLAH CONTOH',
      code: 'BEA4628',
      type: 'SMK',
      state: 'Selangor',
      district: 'PPD CONTOH',
      city: null,
    },
    packages: [
      {
        formLevel: 't4',
        packageId: 1,
        code: 'T4',
        name: 'Pakej SPM Tingkatan 4',
        priceLabel: 'RM 30/pelajar · 2 tahun',
        years: 2,
        assigned:
          t4 === null ? null : { studentQuota: t4, assignedAt: '2026-09-30T10:00:00+08:00' },
      },
      {
        formLevel: 't5',
        packageId: 2,
        code: 'T5',
        name: 'Pakej SPM Tingkatan 5',
        priceLabel: 'RM 30/pelajar · 1 tahun',
        years: 1,
        assigned: null,
      },
    ],
    existingT5Count: 776,
  }
}

let wrapper: VueWrapper | null = null

async function render() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/')
  wrapper = mount(UserPackagesPage, { props: { id: 5601 }, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  api.fetchUserPackages.mockReset()
  api.assignUserPackage.mockReset()
  api.fetchUserPackages.mockResolvedValue(payload())
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('UserPackagesPage (M02 S16)', () => {
  it('shows the school card, both package cards, placeholders and the T5 count', async () => {
    const w = await render()
    expect(w.get('[data-testid=packages-school-name]').text()).toBe('SEKOLAH CONTOH')
    expect(w.get('[data-testid=packages-school-meta]').text()).toBe('SMK · Selangor · PPD CONTOH')
    const t4 = w.get('[data-testid=package-card-t4]')
    expect(t4.text()).toContain('Pakej Tingkatan 4')
    expect(t4.text()).toContain('RM 30/pelajar · 2 tahun')
    expect(t4.get('[data-testid=package-status]').text()).toBe('Belum Ditetapkan')
    expect(t4.get('[data-testid=package-quota]').attributes('placeholder')).toBe('Cth: 150')
    expect(t4.get('[data-testid=package-submit]').text()).toBe('Tetapkan Pakej T4')
    const t5 = w.get('[data-testid=package-card-t5]')
    expect(t5.get('[data-testid=package-quota]').attributes('placeholder')).toBe('Cth: 120')
    expect(w.get('[data-testid=package-t5-count]').text()).toBe(
      '776 pelajar T5 sedia ada dalam sistem',
    )
    expect(w.get('[data-testid=package-quota]').attributes('max')).toBe('2000')
    expect(w.get('[data-testid=packages-back]').attributes('href')).toBe(
      '/admin/users?role=school_admin',
    )
    expect(w.get('[data-testid=packages-edit]').attributes('href')).toBe('/admin/users/5601/edit')
  })

  it('assigns a quota, reloads and shows the assigned badge, the saved quota and the flash', async () => {
    api.assignUserPackage.mockResolvedValue({ data: {}, status: 'Pakej berjaya ditetapkan.' })
    const w = await render()
    api.fetchUserPackages.mockResolvedValue(payload(150))
    const t4 = w.get('[data-testid=package-card-t4]')
    await t4.get('[data-testid=package-quota]').setValue(150)
    await t4.trigger('submit')
    await flushPromises()
    expect(api.assignUserPackage).toHaveBeenCalledWith(5601, {
      formLevel: 't4',
      packageId: 1,
      studentQuota: 150,
    })
    const after = w.get('[data-testid=package-card-t4]')
    expect(after.get('[data-testid=package-status]').text()).toBe('Ditetapkan')
    expect((after.get('[data-testid=package-quota]').element as HTMLInputElement).value).toBe('150')
    expect(useFlashStore().current?.message).toBe('Pakej berjaya ditetapkan.')
  })
})
