// @vitest-environment jsdom
import { type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'
import { usePageMeta } from '@/composables'

import type { StudentKirkpatrick } from '../../../api/types'
import KirkpatrickPelajarPage from '../../../pages/KirkpatrickPelajarPage.vue'
import { all, flat, has, mountPage, squash, t } from '../fixtures'

const api = vi.hoisted(() => ({ fetchKirkpatrickStudent: vi.fn() }))
vi.mock('../../../api', () => api)

const HC_A = [
  'Bahasa Inggeris',
  'Bahasa Melayu',
  'Matematik',
  'Pendidikan Islam',
  'Pendidikan Jasmani & Kesihatan',
  'Pendidikan Moral',
  'Perniagaan',
  'Pertanian',
  'Prinsip Perakaunan',
  'Sains',
  'Sains Komputer',
  'Sejarah',
]

/** Student A: 4664, 8080, T5 (SRS §6.9). */
const studentA = (): StudentKirkpatrick => ({
  student: { id: 4664, name: 'Pelajar Demo 004664', schoolName: 'SMK Demo B', grade: 11 },
  activeDays: 4,
  answers: 219,
  accuracy: 73.1,
  konsistensi: 22.5,
  streak: 1,
  strongest: { subjectName: 'Sejarah', accuracy: 78.9 },
  weakest: { subjectName: 'Matematik', accuracy: 16.7 },
  headcount: {
    year: 2026,
    rows: HC_A.map((subjectName) => ({
      subjectName,
      tov: subjectName === 'Pendidikan Islam' ? 78 : null,
    })),
  },
  platform: [
    { subjectName: 'Matematik', accuracy: 16.7, answers: 6 },
    { subjectName: 'Sejarah', accuracy: 78.9, answers: 190 },
    { subjectName: 'Sains', accuracy: 39.1, answers: 23 },
  ],
})

/** Student B: 4644 (accuracy 38.6%: no accuracy sentence). */
const studentB = (): StudentKirkpatrick => ({
  student: { id: 4644, name: 'Pelajar Demo 004644', schoolName: 'SMK Demo B', grade: 11 },
  activeDays: 3,
  answers: 70,
  accuracy: 38.6,
  konsistensi: 21.1,
  streak: 1,
  strongest: { subjectName: 'Bahasa Melayu', accuracy: 60 },
  weakest: { subjectName: 'Sejarah', accuracy: 0 },
  headcount: {
    year: 2026,
    rows: [
      { subjectName: 'Bahasa Inggeris', tov: 20 },
      { subjectName: 'Sains', tov: 33.33 },
      { subjectName: 'Sejarah', tov: null },
    ],
  },
  platform: [
    { subjectName: 'Sejarah', accuracy: 0, answers: 5 },
    { subjectName: 'Bahasa Melayu', accuracy: 60, answers: 5 },
    { subjectName: 'Pendidikan Islam', accuracy: 55, answers: 20 },
    { subjectName: 'Matematik', accuracy: 40, answers: 15 },
  ],
})

const zero = (): StudentKirkpatrick => ({
  student: { id: 4001, name: 'Pelajar Demo 004001', schoolName: 'SMK Demo B', grade: 10 },
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

let wrapper: VueWrapper | undefined

async function open(id = 4664, prefix = '/admin/kirkpatrick') {
  const m = await mountPage(
    KirkpatrickPelajarPage,
    { basePath: prefix, userId: id },
    `${prefix}/pelajar/${id}`,
    `${prefix}/pelajar/${id}`,
  )
  wrapper = m.wrapper
  return m.wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  setRouteOutcome(null)
  usePageMeta().reset()
  api.fetchKirkpatrickStudent.mockResolvedValue(studentA())
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('S8 header (AC-M12-30.1)', () => {
  it('shows the name, school and form, and the back link to Tahap 3', async () => {
    const w = await open()
    expect(api.fetchKirkpatrickStudent).toHaveBeenCalledWith(4664, expect.anything())
    expect(t(w, 'pel-name').text()).toBe('Pelajar Demo 004664')
    expect(squash(t(w, 'pel-school').text())).toBe('SMK Demo B · Tingkatan 5')
    expect(t(w, 'pel-back').attributes('href')).toBe('/admin/kirkpatrick/behavior')
    expect(t(w, 'pel-back').text()).toBe('Kembali ke Tahap 3')
    expect(w.text()).toContain('ALESA — Analisis Tingkah Laku Kirkpatrick')
    expect(t(w, 'pel-alesa').text()).toContain('AI')
  })

  // SWY-03: http mode answers a string student id; the route prop `userId` is a number.
  it('shows the student when the API id is a string and the route id a number (SWY-03)', async () => {
    const a = studentA()
    api.fetchKirkpatrickStudent.mockResolvedValue({
      ...a,
      student: { ...a.student, id: '4664' },
    })
    const w = await open(4664)
    expect(t(w, 'pel-name').text()).toBe('Pelajar Demo 004664')
  })

  it('prints the Tingkatan of the school year (grade 11 = 5, grade 10 = 4)', async () => {
    const w = await open()
    expect(squash(t(w, 'pel-school').text())).toBe('SMK Demo B · Tingkatan 5')
    wrapper?.unmount()
    api.fetchKirkpatrickStudent.mockResolvedValue(zero())
    const w4 = await open(4001)
    expect(squash(t(w4, 'pel-school').text())).toBe('SMK Demo B · Tingkatan 4')
  })

  it('builds the back link from the /guru prefix on the twin', async () => {
    const w = await open(4664, '/guru/kirkpatrick')
    expect(t(w, 'pel-back').attributes('href')).toBe('/guru/kirkpatrick/behavior')
  })

  it('sets the shell header and the tab title "Kirkpatrick — {nama}" with no subtitle (DV-M12-03)', async () => {
    await open()
    const meta = usePageMeta()
    expect(meta.state.header).toEqual({ title: 'Kirkpatrick — Pelajar Demo 004664' })
    expect(meta.state.title).toBe('Kirkpatrick — Pelajar Demo 004664')
  })

  it('stacks the header below sm', async () => {
    const w = await open()
    expect(t(w, 'kirk-pelajar').get('header').classes()).toContain('flex-col')
  })
})

describe('S8 ALESA card, student A (AC-M12-30.2)', () => {
  it('composes the paragraph with the accuracy and strongest-subject sentences', async () => {
    const w = await open()
    expect(t(w, 'pel-paragraph').text()).toBe(
      'Penggunaan Prestasi Plus oleh Pelajar Demo 004664 masih pada tahap minimum dengan hanya 4 hari aktif. Disarankan untuk meningkatkan kekerapan latihan bagi melihat peningkatan prestasi. Ketepatan jawapan pada 73.1% menunjukkan pemahaman yang baik. Subjek terkuat: Sejarah (78.9%).',
    )
  })

  it('shows the four tiles and the Terkuat / Perlu perhatian line', async () => {
    const w = await open()
    expect(t(w, 'pel-tile-answers').text()).toBe('219Soalan')
    expect(t(w, 'pel-tile-accuracy').text()).toBe('73.1%Ketepatan')
    expect(t(w, 'pel-tile-konsistensi').text()).toBe('22.5Konsistensi')
    expect(t(w, 'pel-tile-streak').text()).toBe('1dStreak')
    expect(flat(t(w, 'pel-strength'))).toBe(
      'Terkuat: Sejarah (78.9%) · Perlu perhatian: Matematik (16.7%)',
    )
    expect(t(w, 'pel-strength').findAll('strong')).toHaveLength(2)
  })

  it('has tiles 2 x 2 below sm and 4 from sm', async () => {
    const w = await open()
    expect(t(w, 'pel-alesa').find('.grid').classes()).toEqual(
      expect.arrayContaining(['grid-cols-2', 'sm:grid-cols-4']),
    )
  })
})

describe('S8 student B (AC-M12-30.3)', () => {
  it('has no accuracy sentence and names Bahasa Melayu as strongest', async () => {
    api.fetchKirkpatrickStudent.mockResolvedValue(studentB())
    const w = await open(4644)
    expect(t(w, 'pel-paragraph').text()).toBe(
      'Penggunaan Prestasi Plus oleh Pelajar Demo 004644 masih pada tahap minimum dengan hanya 3 hari aktif. Disarankan untuk meningkatkan kekerapan latihan bagi melihat peningkatan prestasi. Subjek terkuat: Bahasa Melayu (60.0%).',
    )
    expect(t(w, 'pel-tile-answers').text()).toBe('70Soalan')
    expect(t(w, 'pel-tile-accuracy').text()).toBe('38.6%Ketepatan')
    expect(t(w, 'pel-tile-konsistensi').text()).toBe('21.1Konsistensi')
    expect(flat(t(w, 'pel-strength'))).toBe(
      'Terkuat: Bahasa Melayu (60.0%) · Perlu perhatian: Sejarah (0.0%)',
    )
  })
})

describe('S8 Head Count and platform cards (AC-M12-31.1, 31.2, 31.4)', () => {
  it('lists the Head Count rows with TOV to two decimals or "-"', async () => {
    const w = await open()
    expect(t(w, 'pel-hc-heading').text()).toBe('2026 — Head Count')
    expect(t(w, 'pel-headcount').get('h2').text()).toBe('Tahap 2 — Head Count')
    const rows = all(w, 'pel-hc-row')
    expect(rows.map((r) => r.findAll('span')[0]?.text())).toEqual(HC_A)
    const values = all(w, 'pel-hc-value').map((v) => v.text())
    expect(values[3]).toBe('TOV:78.00')
    expect(values.filter((v) => v === '-')).toHaveLength(11)
  })

  it('shows student B TOV values with two decimals (33.33)', async () => {
    api.fetchKirkpatrickStudent.mockResolvedValue(studentB())
    const w = await open(4644)
    expect(all(w, 'pel-hc-value').map((v) => v.text())).toEqual(['TOV:20.00', 'TOV:33.33', '-'])
  })

  it('lists the platform rows by accuracy descending with "{x}% ({n})"', async () => {
    const w = await open()
    expect(t(w, 'pel-platform').get('h2').text()).toBe('Tahap 2 — Prestasi Platform')
    expect(all(w, 'pel-plat-value').map((v) => v.text())).toEqual([
      '78.9% (190)',
      '39.1% (23)',
      '16.7% (6)',
    ])
  })

  it('colours the bars success (>= 70), warning (50 to < 70) and error (below 50) with value = accuracy', async () => {
    const w = await open()
    const bars = all(w, 'pel-plat-bar')
    expect(bars[0]?.html()).toContain('bg-success')
    expect(bars[0]?.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('78.9')
    expect(bars[1]?.html()).toContain('bg-error')
    expect(bars[2]?.html()).toContain('bg-error')
    wrapper?.unmount()
    api.fetchKirkpatrickStudent.mockResolvedValue(studentB())
    const b = await open(4644)
    expect(all(b, 'pel-plat-value').map((v) => v.text())).toEqual([
      '60.0% (5)',
      '55.0% (20)',
      '40.0% (15)',
      '0.0% (5)',
    ])
    expect(
      all(b, 'pel-plat-bar').map((e) => ['bg-success', 'bg-warning', 'bg-error'].find((c) => e.html().includes(c))),
    ).toEqual(['bg-warning', 'bg-warning', 'bg-error', 'bg-error'])
  })

  it('stacks the two cards below md and puts them side by side from md', async () => {
    const w = await open()
    const grid = t(w, 'pel-headcount').element.parentElement!
    expect(grid.className).toContain('grid-cols-1')
    expect(grid.className).toContain('md:grid-cols-2')
  })
})

describe('S8 zero state (AC-M12-31.3, provisional)', () => {
  it('shows 0, 0%, 0 and 0d with an empty Terkuat line and platform card', async () => {
    api.fetchKirkpatrickStudent.mockResolvedValue(zero())
    const w = await open(4001)
    expect(t(w, 'pel-tile-answers').text()).toBe('0Soalan')
    expect(t(w, 'pel-tile-accuracy').text()).toBe('0%Ketepatan')
    expect(t(w, 'pel-tile-konsistensi').text()).toBe('0Konsistensi')
    expect(t(w, 'pel-tile-streak').text()).toBe('0dStreak')
    expect(has(w, 'pel-strength')).toBe(false)
    expect(all(w, 'pel-plat-row')).toHaveLength(0)
    expect(t(w, 'pel-paragraph').text()).not.toContain('Subjek terkuat')
    expect(t(w, 'pel-paragraph').text()).not.toContain('Ketepatan jawapan')
  })
})

describe('S8 navigation between students', () => {
  it('does not show the previous student while the next one loads', async () => {
    const w = await open(4664)
    expect(t(w, 'pel-name').text()).toBe('Pelajar Demo 004664')
    let release: (v: StudentKirkpatrick) => void = () => {}
    api.fetchKirkpatrickStudent.mockReturnValue(new Promise((r) => (release = r)))
    await w.setProps({ userId: 4644 })
    expect(has(w, 'pel-name')).toBe(false)
    release(studentB())
    await vi.waitFor(() => expect(t(w, 'pel-name').text()).toBe('Pelajar Demo 004644'))
  })
})

describe('S8 access (AC-M12-03.4, 30.5)', () => {
  it.each([5571, 5551, 99999999])('renders the 403 page in place for id %i', async (id) => {
    api.fetchKirkpatrickStudent.mockRejectedValue(
      new ApiError({ status: 403, code: 'FORBIDDEN', message: 'no' }),
    )
    const w = await open(id)
    expect(useRouteOutcome().value).toBe(403)
    expect(has(w, 'pel-name')).toBe(false)
  })

  it('shows the error line on another failure', async () => {
    api.fetchKirkpatrickStudent.mockRejectedValue(new Error('boom'))
    const w = await open()
    expect(has(w, 'kirk-error')).toBe(true)
    expect(useRouteOutcome().value).toBeNull()
  })
})

describe('S8 string ids in http mode (BUG-01)', () => {
  it('renders the student when the API sends student.id as a string (contract IdSchema)', async () => {
    const stringId = studentA()
    stringId.student.id = '4664'
    api.fetchKirkpatrickStudent.mockResolvedValue(stringId)
    const w = await open(4664)
    expect(api.fetchKirkpatrickStudent).toHaveBeenCalledWith(4664, expect.anything())
    expect(t(w, 'pel-name').text()).toBe('Pelajar Demo 004664')
    expect(has(w, 'pel-alesa')).toBe(true)
  })

  it('still hides a previous student of another id (S8 to S8 navigation)', async () => {
    const other = studentB()
    other.student.id = '4644'
    api.fetchKirkpatrickStudent.mockResolvedValue(other)
    const w = await open(4664)
    expect(w.find('[data-testid="pel-alesa"]').exists()).toBe(false)
  })
})
