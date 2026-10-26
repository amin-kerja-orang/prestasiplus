import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import analisaItem from '../../routes/analisa-item'
import classRoutes from '../../routes/class'
import prestasi from '../../routes/prestasi'

/**
 * SW5-09 / DV-M08-49: a class id is digits only, like the `/headcount` ids, so a non-numeric id is never
 * handed to the page (it would call `GET …/classes/NaN`) and falls through to the 404 catch-all.
 */
const router = createRouter({
  history: createMemoryHistory(),
  routes: [...prestasi, ...classRoutes, ...analisaItem],
})

describe('M08 class detail routes take a numeric id only', () => {
  it('/prestasi/kelas/:id matches a number and not text', () => {
    expect(router.resolve('/prestasi/kelas/15').name).toBe('m08.prestasi.kelas.detail')
    expect(router.resolve('/prestasi/kelas/15').params.id).toBe('15')
    expect(router.resolve('/prestasi/kelas/abc').matched).toHaveLength(0)
    expect(router.resolve('/prestasi/kelas/12abc').matched).toHaveLength(0)
  })

  it('/analisa-item/kelas/:id matches a number and not text', () => {
    expect(router.resolve('/analisa-item/kelas/15').name).toBe('m08.analisa-item.kelas.detail')
    expect(router.resolve('/analisa-item/kelas/15').params.id).toBe('15')
    expect(router.resolve('/analisa-item/kelas/abc').matched).toHaveLength(0)
    expect(router.resolve('/analisa-item/kelas/12abc').matched).toHaveLength(0)
  })
})
