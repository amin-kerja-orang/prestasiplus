import { effectScope, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ fetchCcSchoolDrill: vi.fn() }))
vi.mock('../../api/command-center-board', async (importActual) => ({
  ...(await importActual<typeof import('../../api/command-center-board')>()),
  fetchCcSchoolDrill: api.fetchCcSchoolDrill,
}))

import type { CcPeriod } from '../../api/command-center-board-types'
import { useSchoolDrill } from '../../components/command-center-board/composables'

describe('useSchoolDrill with a string school id (http mode)', () => {
  it('opens the drill for "42", then a second toggle of the same id closes it', async () => {
    api.fetchCcSchoolDrill.mockResolvedValue({ rows: [] })
    const drill = effectScope().run(() => useSchoolDrill(ref<CcPeriod>('today')))!
    await drill.toggle('42')
    expect(api.fetchCcSchoolDrill).toHaveBeenCalledWith('42', 'today', expect.anything())
    expect(drill.state.value).toMatchObject({ schoolId: '42', status: 'ok' })
    await drill.toggle('42')
    expect(drill.state.value).toBeNull()
  })
})
