// @vitest-environment jsdom
/**
 * MonthlyTable empty state (SW7-04, DV-M27-25): the genuine empty copy by default, the 5-pupil copy only when the
 * page says the month was hidden by the API's cohort rule.
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import MonthlyTable from '../../components/monthly/MonthlyTable.vue'

const empty = (cohortHidden?: boolean) =>
  mount(MonthlyTable, { props: { months: [], total: null, cohortHidden } }).get(
    '[data-testid="lb-table-empty"]',
  )

describe('MonthlyTable empty state', () => {
  it('defaults to "Tiada aktiviti direkodkan buat masa ini"', () => {
    expect(empty().text()).toContain('Tiada data')
    expect(empty().text()).toContain('Tiada aktiviti direkodkan buat masa ini')
  })

  it('cohortHidden: "Disembunyikan kerana kurang daripada 5 pelajar aktif."', () => {
    const t = empty(true).text()
    expect(t).toContain('Tiada data')
    expect(t).toContain('Disembunyikan kerana kurang daripada 5 pelajar aktif.')
    expect(t).not.toContain('Tiada aktiviti')
  })
})
