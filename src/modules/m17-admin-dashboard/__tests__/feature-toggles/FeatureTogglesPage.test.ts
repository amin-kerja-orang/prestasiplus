// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import type { FeatureToggle } from '../../api/feature-toggles'
import FeatureTogglesPage from '../../pages/FeatureTogglesPage.vue'

const api = vi.hoisted(() => ({ fetchFeatureToggles: vi.fn(), setFeatureToggle: vi.fn() }))
vi.mock('../../api/feature-toggles', () => api)

const row = (key: string, labelMs: string, extra: Partial<FeatureToggle> = {}): FeatureToggle => ({
  key,
  labelMs,
  audience: 'pelajar',
  enabled: true,
  locked: false,
  ...extra,
})

const ROWS: FeatureToggle[] = [
  row('permainan', 'Zona Permainan'),
  row('latih-tubi', 'Latih Tubi'),
  row('cikgu-alesa', 'Cikgu Alesa', { enabled: false, locked: true }),
  row('guru.kelas', 'Kelas', { audience: 'guru' }),
]

let wrapper: VueWrapper | null = null
let confirmSpy: ReturnType<typeof vi.spyOn>

async function render(rows: FeatureToggle[] = ROWS): Promise<VueWrapper> {
  api.fetchFeatureToggles.mockResolvedValue(rows)
  wrapper = mount(FeatureTogglesPage, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

const switchOf = (key: string) =>
  wrapper!.find(`[data-testid="ft-row-${key}"] button[role="switch"]`)
const flash = () => useFlashStore().current

beforeEach(() => {
  setActivePinia(createPinia())
  api.fetchFeatureToggles.mockReset()
  api.setFeatureToggle.mockReset()
  confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  confirmSpy.mockRestore()
})

describe('FeatureTogglesPage', () => {
  it('lists every row grouped Pelajar then Guru, in server order, with Aktif / Off', async () => {
    await render()
    const groups = wrapper!.findAll('section')
    expect(groups.map((g) => g.find('h2').text())).toEqual(['Pelajar', 'Guru'])
    expect(groups[0]!.findAll('[data-testid^="ft-row-"]').map((li) => li.attributes('data-testid'))).toEqual([
      'ft-row-permainan',
      'ft-row-latih-tubi',
      'ft-row-cikgu-alesa',
    ])
    expect(wrapper!.get('[data-testid="ft-state-permainan"]').text()).toBe('Aktif')
    expect(wrapper!.get('[data-testid="ft-state-guru.kelas"]').text()).toBe('Aktif')
  })

  it('shows the default-ON notice above the groups', async () => {
    await render()
    expect(wrapper!.get('[data-testid="ft-notice"]').text()).toBe(
      'Semua ciri HIDUP secara lalai — item hanya tersembunyi apabila anda mematikannya.',
    )
  })

  it('does not draw an empty Guru group', async () => {
    await render(ROWS.filter((r) => r.audience === 'pelajar'))
    expect(wrapper!.findAll('section').map((g) => g.find('h2').text())).toEqual(['Pelajar'])
  })

  it('shows a locked row as Off with its switch disabled', async () => {
    await render()
    expect(wrapper!.get('[data-testid="ft-state-cikgu-alesa"]').text()).toBe('Off')
    expect(switchOf('cikgu-alesa').attributes('disabled')).toBeDefined()
    expect(switchOf('permainan').attributes('disabled')).toBeUndefined()
  })

  it('shows "Tiada ciri didaftarkan." when there are no rows', async () => {
    await render([])
    expect(wrapper!.get('[data-testid="ft-empty"]').text()).toContain('Tiada ciri didaftarkan.')
    expect(wrapper!.find('section').exists()).toBe(false)
  })

  it('asks before turning a pupil flag OFF and writes only after the answer', async () => {
    api.setFeatureToggle.mockResolvedValue(row('permainan', 'Zona Permainan', { enabled: false }))
    await render()
    await switchOf('permainan').trigger('click')
    await flushPromises()
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(confirmSpy.mock.calls[0]![0]).toBe(
      'Modul ini akan hilang daripada menu dan pautannya akan memaparkan halaman 404.',
    )
    expect(api.setFeatureToggle).toHaveBeenCalledWith('permainan', false)
    expect(flash()).toEqual({ type: 'success', message: 'Ciri "Zona Permainan" telah DINYAHAKTIFKAN.' })
    expect(wrapper!.get('[data-testid="ft-state-permainan"]').text()).toBe('Off')
  })

  it('keeps the flag ON and writes nothing when the confirm is cancelled', async () => {
    confirmSpy.mockReturnValue(false)
    await render()
    await switchOf('permainan').trigger('click')
    await flushPromises()
    expect(api.setFeatureToggle).not.toHaveBeenCalled()
    expect(wrapper!.get('[data-testid="ft-state-permainan"]').text()).toBe('Aktif')
  })

  it('turns a flag ON without a confirm and flashes DIAKTIFKAN', async () => {
    api.setFeatureToggle.mockResolvedValue(row('permainan', 'Zona Permainan'))
    await render([row('permainan', 'Zona Permainan', { enabled: false })])
    await switchOf('permainan').trigger('click')
    await flushPromises()
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(api.setFeatureToggle).toHaveBeenCalledWith('permainan', true)
    expect(flash()).toEqual({ type: 'success', message: 'Ciri "Zona Permainan" telah DIAKTIFKAN.' })
  })

  it('turns a guru flag OFF without a confirm', async () => {
    api.setFeatureToggle.mockResolvedValue(row('guru.kelas', 'Kelas', { audience: 'guru', enabled: false }))
    await render()
    await switchOf('guru.kelas').trigger('click')
    await flushPromises()
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(flash()).toEqual({ type: 'success', message: 'Ciri "Kelas" telah DINYAHAKTIFKAN.' })
  })

  it('puts the switch back and shows the error when the write fails', async () => {
    api.setFeatureToggle.mockRejectedValue(new ApiError({ status: 500, code: 'SERVER_ERROR', message: '' }))
    await render()
    await switchOf('latih-tubi').trigger('click')
    await flushPromises()
    expect(wrapper!.get('[data-testid="ft-state-latih-tubi"]').text()).toBe('Aktif')
    expect(flash()).toEqual({
      type: 'error',
      message: 'Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar lagi.',
    })
  })

  it('shows the BM server message of a refused change (4xx)', async () => {
    api.setFeatureToggle.mockRejectedValue(
      new ApiError({ status: 409, code: 'FEATURE_LOCKED', message: 'Ciri ini dikunci.' }),
    )
    await render()
    await switchOf('latih-tubi').trigger('click')
    await flushPromises()
    expect(flash()).toEqual({ type: 'error', message: 'Ciri ini dikunci.' })
  })

  it('shows the offline text when the request never arrived', async () => {
    api.setFeatureToggle.mockRejectedValue(new ApiError({ status: 0, code: 'NETWORK_ERROR', message: '' }))
    await render()
    await switchOf('guru.kelas').trigger('click')
    await flushPromises()
    expect(flash()).toEqual({ type: 'error', message: 'Tindakan tidak dapat dihantar. Semak sambungan anda.' })
  })
})
