// @vitest-environment jsdom
import { type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { setRouteOutcome } from '@/app/router/outcome'
import { usePageMeta } from '@/composables'
import { provideShellSubtitle, shellPageSubtitle } from '@/ds'

import type { StudentKirkpatrick } from '../../../api/types'
import KirkpatrickPelajarPage from '../../../pages/KirkpatrickPelajarPage.vue'
import { mountPage, squash, t } from '../fixtures'

const api = vi.hoisted(() => ({ fetchKirkpatrickStudent: vi.fn() }))
vi.mock('../../../api', () => api)

const student = (): StudentKirkpatrick => ({
  student: { id: 4664, name: 'Pelajar Demo 004664', schoolName: 'SMK Demo B', grade: 11 },
  activeDays: 0,
  answers: 0,
  accuracy: 0,
  konsistensi: 0,
  streak: 0,
  strongest: null,
  weakest: null,
  headcount: { year: 2026, rows: [] },
  platform: [],
})

/** A Pentadbiran-like shell: it prints a lifted plain-text page subtitle in its own header. */
const InShell = defineComponent({
  props: { userId: { type: Number, required: true }, basePath: { type: String, default: '' } },
  setup(p) {
    provideShellSubtitle()
    return () => h(KirkpatrickPelajarPage, p)
  },
})

let wrapper: VueWrapper | undefined

beforeEach(() => {
  vi.clearAllMocks()
  setRouteOutcome(null)
  usePageMeta().reset()
  api.fetchKirkpatrickStudent.mockResolvedValue(student())
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('S8 under a shell that lifts the subtitle (C-58, DV-M12-03, DV-SH-03)', () => {
  it('lifts nothing into the shell header and keeps the school line in the body', async () => {
    const m = await mountPage(
      InShell,
      { userId: 4664, basePath: '/admin/kirkpatrick' },
      '/admin/kirkpatrick/pelajar/4664',
      '/admin/kirkpatrick/pelajar/4664',
    )
    wrapper = m.wrapper
    expect(shellPageSubtitle.value).toBeNull()
    expect(usePageMeta().state.header).toEqual({ title: 'Kirkpatrick — Pelajar Demo 004664' })
    expect(usePageMeta().state.title).toBe('Kirkpatrick — Pelajar Demo 004664')
    const school = t(m.wrapper, 'pel-school')
    expect(squash(school.text())).toBe('SMK Demo B · Tingkatan 5')
    expect(school.attributes('hidden')).toBeUndefined()
    expect(t(m.wrapper, 'pel-name').text()).toBe('Pelajar Demo 004664')
  })
})
