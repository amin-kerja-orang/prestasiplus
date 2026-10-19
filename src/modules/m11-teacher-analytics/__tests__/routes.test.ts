/**
 * M11 route wiring (build-plan §S.3 rule 2): `routes.ts` only spreads the `routes/<group>.ts` fragments,
 * which M11-T1 creates empty; the UI tasks fill them. The manifest exposes the module id and the typed
 * client (`./api`).
 */

import { describe, expect, it } from 'vitest'

import * as m11 from '../index'
import routes from '../routes'
import analisisItem from '../routes/analisis-item'
import laporan from '../routes/laporan'
import laporanMingguan from '../routes/laporan-mingguan'
import monitoring from '../routes/monitoring'
import perbandinganKelas from '../routes/perbandingan-kelas'

describe('M11 routes', () => {
  it('spreads the five fragments (S1, S6, S2–S5, S8, S7), all empty until their UI tasks', () => {
    for (const fragment of [
      laporan,
      analisisItem,
      monitoring,
      laporanMingguan,
      perbandinganKelas,
    ]) {
      expect(Array.isArray(fragment)).toBe(true)
    }
    expect(routes).toEqual([
      ...analisisItem,
      ...laporan,
      ...laporanMingguan,
      ...monitoring,
      ...perbandinganKelas,
    ])
  })

  it('the manifest names the module and exports the typed client', () => {
    expect(m11.manifest).toMatchObject({ id: 'M11', slug: 'm11-teacher-analytics' })
    for (const fn of [
      'fetchTeacherReport',
      'fetchItemAnalysis',
      'fetchMonitoringOverview',
      'fetchSchoolDetail',
      'fetchStudentDetail',
      'fetchTeacherDetail',
      'fetchMonitoringExport',
    ] as const) {
      expect(typeof m11[fn]).toBe('function')
    }
  })
})
