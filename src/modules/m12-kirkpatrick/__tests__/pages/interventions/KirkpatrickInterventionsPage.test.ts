// @vitest-environment jsdom
import { type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'

import type { InterventionList, InterventionRow } from '../../../api/types'
import KirkpatrickInterventionsPage from '../../../pages/KirkpatrickInterventionsPage.vue'
import { all, has, itemLabels, mountPage, pick, rowOf, select, squash, t } from '../fixtures'

const api = vi.hoisted(() => ({
  fetchKirkpatrickInterventions: vi.fn(),
  createKirkpatrickIntervention: vi.fn(),
}))
vi.mock('../../../api', () => api)

const empty = (): InterventionList => ({ kpi: { total: 0, pending: 0, up: 0, down: 0 }, rows: [] })

const row = (over: Partial<InterventionRow>): InterventionRow => ({
  id: 1,
  studentId: 4664,
  alertType: 'inactive',
  actionDate: '2026-09-25',
  alertDescription: 'Tidak aktif',
  actionTaken: 'Hubungi guru kelas',
  beforeAccuracy: 40,
  afterAccuracy: null,
  beforeMood: null,
  afterMood: null,
  createdBy: 1,
  createdAt: '2026-09-25T15:40:00+08:00',
  updatedAt: '2026-09-25T15:40:00+08:00',
  status: 'Menunggu Semakan',
  studentName: 'Pelajar Demo 004664',
  ...over,
})

let wrapper: VueWrapper | undefined

async function open(prefix = '/admin/kirkpatrick') {
  const m = await mountPage(
    KirkpatrickInterventionsPage,
    { basePath: prefix },
    `${prefix}/interventions`,
    `${prefix}/interventions`,
  )
  wrapper = m.wrapper
  return m.wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  setRouteOutcome(null)
  api.fetchKirkpatrickInterventions.mockResolvedValue(empty())
  api.createKirkpatrickIntervention.mockResolvedValue({})
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

const isOpen = (w: VueWrapper) =>
  t(w, 'int-form').attributes('style')?.includes('display: none') !== true

describe('S7 KPIs and empty list (AC-M12-28.1, 28.3)', () => {
  it('shows four zero KPI cards in a 2-column grid below md and 4 from md', async () => {
    const w = await open()
    expect(all(w, 'kirk-stat-label').map((e) => e.text())).toEqual([
      'Jumlah Intervensi',
      'Menunggu Semakan',
      'Meningkat',
      'Menurun',
    ])
    expect(all(w, 'kirk-stat-value').map((e) => e.text())).toEqual(['0', '0', '0', '0'])
    expect(t(w, 'int-kpis').classes()).toEqual(
      expect.arrayContaining(['grid-cols-2', 'md:grid-cols-4']),
    )
  })

  it('shows only the empty line, without the "Ambil Tindakan" sentence (DV-M12-01)', async () => {
    const w = await open()
    expect(t(w, 'int-list').get('h2').text()).toBe('Senarai Intervensi')
    expect(squash(t(w, 'int-empty').text())).toBe('Tiada intervensi direkodkan lagi.')
    expect(w.text()).not.toContain('Ambil Tindakan')
  })

  it('has the tab strip with Intervensi active', async () => {
    const w = await open()
    expect(t(w, 'kirk-tab-interventions').attributes('data-active')).toBe('true')
  })
})

describe('S7 form panel (AC-M12-29.1, 29.2, 29.6)', () => {
  it('is closed on load, opens and closes by the header button, and flips the caret (aria-expanded)', async () => {
    const w = await open()
    expect(isOpen(w)).toBe(false)
    expect(t(w, 'int-form-toggle').attributes('aria-expanded')).toBe('false')
    await t(w, 'int-form-toggle').trigger('click')
    expect(isOpen(w)).toBe(true)
    expect(t(w, 'int-form-toggle').attributes('aria-expanded')).toBe('true')
    await t(w, 'int-form-toggle').trigger('click')
    expect(isOpen(w)).toBe(false)
  })

  it('has the nine fields, labels, placeholders, options, defaults and required flags', async () => {
    const w = await open()
    const form = t(w, 'int-form')
    expect(form.findAll('label').map((l) => l.text())).toEqual([
      'Pelajar (ID)',
      'Jenis Amaran',
      'Tarikh Tindakan',
      'Penerangan Amaran',
      'Tindakan Diambil',
      'Ketepatan Sebelum (%)',
      'Mood Sebelum',
      'Ketepatan Selepas (%)',
      'Mood Selepas',
    ])
    const student = t(w, 'int-student')
    expect(student.attributes('type')).toBe('number')
    expect(student.attributes('placeholder')).toBe('ID pelajar')
    expect(student.attributes('required')).toBeDefined()
    expect(select(w, 'alert_type').props('items')).toEqual([
      { value: 'mood', label: 'Mood / Kesejahteraan' },
      { value: 'inactive', label: 'Tidak Aktif' },
      { value: 'declining', label: 'Prestasi Menurun' },
    ])
    expect(select(w, 'alert_type').props('modelValue')).toBe('mood')
    expect(t(w, 'int-date').attributes('required')).toBeDefined()
    expect((t(w, 'int-date').element as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(t(w, 'int-desc').attributes('placeholder')).toBe(
      'Contoh: Pelajar tidak aktif selama 2 minggu',
    )
    expect(t(w, 'int-desc').attributes('rows')).toBe('2')
    expect(t(w, 'int-action').attributes('placeholder')).toBe(
      'Contoh: Hubungi pelajar melalui guru kelas',
    )
    expect(t(w, 'int-before').attributes('step')).toBe('0.1')
    expect(t(w, 'int-before').attributes('placeholder')).toBe('0.0')
    expect(t(w, 'int-after').attributes('placeholder')).toBe('Isi selepas semakan')
    for (const name of ['before_mood', 'after_mood']) {
      expect(itemLabels(w, name)).toEqual(['-- Pilih --', 'Gembira', 'Okay', 'Sedih', 'Tertekan'])
    }
    expect(form.attributes('autocomplete')).toBe('off')
    expect(t(w, 'int-submit').text()).toBe('Simpan Intervensi')
  })

  it('lays out one column below md with 3 columns in row 1 from md and 2 / 4 for before and after', async () => {
    const w = await open()
    const grids = t(w, 'int-form').findAll(':scope > div')
    expect(grids[0]?.classes()).toEqual(expect.arrayContaining(['grid-cols-1', 'md:grid-cols-3']))
    expect(grids[3]?.classes()).toEqual(expect.arrayContaining(['grid-cols-2', 'md:grid-cols-4']))
  })

  it('makes the header button at least 36 px tall (min-h-11)', async () => {
    const w = await open()
    expect(t(w, 'int-form-toggle').classes()).toContain('min-h-11')
  })

  it('validates natively: no novalidate and the five required fields are marked', async () => {
    const w = await open()
    expect(t(w, 'int-form').attributes('novalidate')).toBeUndefined()
    const required = t(w, 'int-form')
      .findAll('[required]')
      .map((e) => e.attributes('name'))
    expect(required).toEqual([
      'student_id',
      'alert_type',
      'action_date',
      'alert_description',
      'action_taken',
    ])
  })
})

describe('S7 save (AC-M12-29.4, 29.5)', () => {
  async function fill(w: VueWrapper, studentId: string) {
    await t(w, 'int-form-toggle').trigger('click')
    await t(w, 'int-student').setValue(studentId)
    await pick(w, 'alert_type', 'inactive')
    await t(w, 'int-desc').setValue('Tidak aktif 2 minggu')
    await t(w, 'int-action').setValue('Hubungi guru kelas')
    await t(w, 'int-before').setValue('73.1')
  }

  it('posts the record, closes the panel, resets the form and reloads the KPIs and list', async () => {
    const w = await open()
    await fill(w, '4664')
    api.fetchKirkpatrickInterventions.mockResolvedValue({
      kpi: { total: 1, pending: 1, up: 0, down: 0 },
      rows: [row({})],
    })
    await t(w, 'int-form').trigger('submit')
    await vi.waitFor(() => expect(api.createKirkpatrickIntervention).toHaveBeenCalledTimes(1))
    const body = api.createKirkpatrickIntervention.mock.calls[0]?.[0] as Record<string, unknown>
    expect(body).toMatchObject({
      studentId: 4664,
      alertType: 'inactive',
      alertDescription: 'Tidak aktif 2 minggu',
      actionTaken: 'Hubungi guru kelas',
      beforeAccuracy: 73.1,
      afterAccuracy: null,
      beforeMood: null,
      afterMood: null,
    })
    await vi.waitFor(() => expect(all(w, 'int-row-student')).toHaveLength(1))
    expect(isOpen(w)).toBe(false)
    expect(all(w, 'kirk-stat-value').map((e) => e.text())).toEqual(['1', '1', '0', '0'])
    expect((t(w, 'int-student').element as HTMLInputElement).value).toBe('')
    expect(has(w, 'int-student-error')).toBe(false)
  })

  it('keeps the panel open and the values and shows the refusal under "Pelajar (ID)"', async () => {
    api.createKirkpatrickIntervention.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: { studentId: 'Pelajar tidak dijumpai.' },
      }),
    )
    const w = await open()
    await fill(w, '99999999')
    await t(w, 'int-form').trigger('submit')
    await vi.waitFor(() => expect(has(w, 'int-student-error')).toBe(true))
    expect(t(w, 'int-student-error').text()).toBe('Pelajar tidak dijumpai.')
    expect(isOpen(w)).toBe(true)
    expect((t(w, 'int-student').element as HTMLInputElement).value).toBe('99999999')
    expect((t(w, 'int-desc').element as HTMLTextAreaElement).value).toBe('Tidak aktif 2 minggu')
    expect(api.fetchKirkpatrickInterventions).toHaveBeenCalledTimes(1)
  })
})

describe('S7 list (AC-M12-28.2)', () => {
  it('lists the rows as given (newest first) with the form labels as headers and status pills', async () => {
    api.fetchKirkpatrickInterventions.mockResolvedValue({
      kpi: { total: 2, pending: 1, up: 1, down: 0 },
      rows: [
        row({
          id: 2,
          beforeAccuracy: 40,
          afterAccuracy: 55.5,
          status: 'Meningkat',
          afterMood: 'happy',
        }),
        row({ id: 1 }),
      ],
    })
    const w = await open()
    expect(
      t(w, 'int-list')
        .findAll('thead th')
        .map((h) => h.text()),
    ).toEqual([
      'Tarikh Tindakan',
      'Pelajar (ID)',
      'Jenis Amaran',
      'Penerangan Amaran',
      'Tindakan Diambil',
      'Ketepatan Sebelum (%)',
      'Ketepatan Selepas (%)',
      'Status',
    ])
    const rows = all(w, 'int-row-student').map(rowOf)
    expect(rows).toHaveLength(2)
    expect(all(w, 'int-row-status').map((e) => e.text())).toEqual(['Meningkat', 'Menunggu Semakan'])
    expect(all(w, 'int-row-status')[0]?.classes()).toContain('text-success')
    expect(all(w, 'int-row-status')[1]?.classes()).toContain('text-warning')
    expect(rows[0]?.get('[data-testid="int-row-after"]').text()).toBe('55.5% · Gembira')
    expect(rows[1]?.get('[data-testid="int-row-after"]').text()).toBe('-')
    expect(rows[0]?.text()).toContain('25 Sep 2026')
    expect(rows[0]?.text()).toContain('Tidak Aktif')
    expect(has(w, 'int-empty')).toBe(false)
    expect(t(w, 'int-list').find('[data-ds="paged-table"]').exists()).toBe(true)
  })
})
