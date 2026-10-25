// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createMemoryHistory } from 'vue-router'

import { createAppRouter } from '@/app/router'
import { activeItem } from '@/shells/pentadbiran/menu'

import { emptyCopy } from '../admin/papers/ui'
import {
  INTAKE_ROUTES,
  intakeManualEditPath,
  intakeReviewPath,
} from '../admin/intake/lib/intake-routes'

describe('manual question entry stays under Tulis Soalan Manual (UAT A-KS16)', () => {
  it('the editor of a manual batch has its own URL, not the extract one', () => {
    expect(intakeManualEditPath('ek-7')).toBe('/admin/spm/soalan/manual/ek-7')
    expect(intakeManualEditPath('ek-7')).not.toContain('ekstrak')
    expect(intakeReviewPath('ek-7')).toBe('/admin/spm/soalan/ekstrak/ek-7')
  })

  it('both URLs resolve to the editor page and carry the batch id', () => {
    const router = createAppRouter({ history: createMemoryHistory() })
    const manual = router.resolve(intakeManualEditPath('ek-7'))
    expect(manual.name).toBe(INTAKE_ROUTES.manualEdit)
    expect(manual.params.batchId).toBe('ek-7')
    expect(manual.meta.roles).toEqual(['admin'])
    expect(manual.meta.header).toMatchObject({ title: 'Tulis Soalan Manual' })
    expect(router.resolve(intakeReviewPath('ek-7')).name).toBe(INTAKE_ROUTES.review)
  })

  it('the sidebar keeps Tulis Soalan Manual active while the manual batch is edited', () => {
    expect(activeItem(intakeManualEditPath('ek-7'))?.id).toBe('KS-16')
    expect(activeItem(intakeReviewPath('ek-7'))?.id).toBe('KS-14')
  })
})

describe('review queue empty state (UAT A-KS15)', () => {
  it('says nothing matched when a filter is active, instead of "queue empty"', () => {
    expect(emptyCopy(true, 'semakan').title).toBe('Tiada soalan dijumpai')
    expect(emptyCopy(true, 'ditolak').description).toBe('Cuba ubah atau set semula penapis.')
  })

  it('has its own copy per status tab when no filter is active', () => {
    expect(emptyCopy(false, 'semakan').title).toBe('Baris gilir kosong')
    expect(emptyCopy(false, 'draf').title).toBe('Tiada soalan perlu dibetulkan')
    expect(emptyCopy(false, 'ditolak').title).toBe('Tiada soalan ditolak')
  })
})
