/**
 * AC-CHAIN-5 "Headcount from key-in to every view" (40-cross-cutting X9; card S6-T03, the last card of chain 5; S9-T06 runs it).
 * Runs under playwright.http.config.ts (real stack, CI seed) on mobile, tablet and desktop.
 *
 * One record is entered on the first side and the same figure is asserted on every other side:
 *   1. the teacher sets, for Sains in a class 4A, TOV 40 and RS/ETR 80 with 3 OTRs in an Auto config ("Simpan Sasaran");
 *   2. the pupil answers 10 Sains questions through the real practice API, 6 correct;
 *   3. teacher table, pupil /headcount card and detail, school-admin read-only list, the Prestasi pill and the
 *      "{n} entri headcount" count all show the same figures (OTR1 53, OTR2 66, OTR3 80, AR 60, Below, Sederhana);
 *   4. 10 more answers, all correct (16 of 20): AR 80, On Track, Tinggi, the teacher's On Track count is +1 on Dashboard
 *      Headcount and on the class dashboard;
 *   5. throughout, the school-admin dashboard (XS-1..XS-5) equals the teacher screens of the same school.
 *
 * Data: created through the public API as the seed roles, never by writing the DB. Every record is named with `ujiName`
 * (class, pupil), so U-OP-14 can remove it. The pupil is new for each run (a pupil's Auto AR is its pooled answers of the
 * year, so a re-used pupil would carry the answers of the earlier project run). Its one-time password stays in memory:
 * trace, screenshot and video are off for this file.
 *
 * Display rule (decision 11): accuracy is one decimal on the wire, null at 0 answers; on screen the whole number rounded
 * half up, or "—". Never Math.trunc.
 *
 * Product gaps found while writing the spec were FINDING-1, -2, -3 and -6. They are fixed by #1065 (teacher "Jurang +40",
 * pupil "Belum capai sasaran") and #1066 (the staff Headcount reads of an Auto pupil), so they are now hard assertions.
 *   FINDING-5 (not asserted here) a pupil created by the school admin has `grade = null` (`managed-users.service.ts:196`), so
 *             XS-1 leaves it out. `/api/performance/school` counted its answers too (dashboard 80 vs teacher 90 answers) until
 *             #1069 (S6-T03 school() totals -> XS-1), which `expectXsEqual` needs on the base.
 */
import type { Browser, BrowserContext, Page } from '@playwright/test'

import { roundHalfUp } from '../../../src/lib/number/format'
import { csrfOf, expectNoHScroll, newPeerContext } from '../../api/helpers'
import { expect, test } from '../../fixtures/api'

import { loginAs, loginViaUi, ujiName } from './helpers'

// --- small http helpers ----------------------------------------------------------------------------------------------------

type Json = Record<string, unknown>

/** One call as the signed-in page (cookie session + CSRF header); the body is the `data` of the envelope. */
async function call<T = Json>(
  page: Page,
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body?: unknown,
  expected: number[] = [200, 201],
): Promise<T> {
  const res = await page.request.fetch(path, {
    method,
    headers: { 'x-csrf-token': await csrfOf(page) },
    ...(body === undefined ? {} : { data: body }),
  })
  expect(expected, `${method} ${path} -> ${String(res.status())}`).toContain(res.status())
  const json = (await res.json()) as { data?: T }
  return (json.data ?? (json as unknown)) as T
}

const squash = (text: string): string => text.replace(/\s+/g, ' ').trim()

/** "1,234" as the app groups it. */
const grouped = (n: number): string => n.toLocaleString('en-US')

/** Whole-number accuracy as the screens show it (decision 11): half up, "—" when there is none. */
const shownAccuracy = (v: number | null): string =>
  v === null ? '—' : `${String(roundHalfUp(v))}%`

/** The number that stands before `label` in a stat row text ("20 Murid"). */
function numberBefore(text: string, label: string): number {
  const m = new RegExp(`(\\d[\\d,]*)\\s*${label}`).exec(squash(text))
  expect(m, `"${label}" with its number in: ${squash(text).slice(0, 300)}`).not.toBeNull()
  return Number(((m as RegExpExecArray)[1] ?? '').replace(/,/g, ''))
}

interface Peer {
  context: BrowserContext
  page: Page
}

async function peer(browser: Browser, info: Parameters<typeof newPeerContext>[1]): Promise<Peer> {
  const context = await newPeerContext(browser, info)
  return { context, page: await context.newPage() }
}

// --- the figures of the chain ----------------------------------------------------------------------------------------------

interface ConfigDetail {
  config: {
    id: string
    mode: string
    activeOtrs: number
    defaultTov: number | null
    defaultEtr: number | null
  }
  chips: { onTrack: number; below: number; empty: number; total: number }
  rows: {
    userId: string
    tov: number | null
    etr: number | null
    status: string
    projection: { confidence: string } | null
    cells: { target: number | null; ar: number | null; tone: string }[]
  }[]
  averages: { otrs: (number | null)[]; ars: (number | null)[] }
}

interface PupilSection {
  configId: string
  status: string
  entryStatus: string
  jurang: number | null
  keyakinan: string | null
  tov: number | null
  etr: number | null
  rows: { checkpoint: number; target: number | null; ar: number | null; tone: string }[]
}

interface SchoolFigures {
  /** `GET /api/admin-sekolah/dashboard`: XS-1 `cards.pupils`, XS-3 `cards.teachers`, XS-4/5 `performance.practice`. */
  dash: {
    pupils: number
    teachers: number
    questions: number
    sessions: number
    accuracy: number | null
    entries: number
  }
  /** `GET /api/performance/school` as the teacher: the Prestasi sekolah screen. */
  teacher: {
    students: number
    teachers: number
    answered: number
    sessions: number
    accuracy: number | null
    entries: number
  }
  /** `GET /api/performance/school` as the school admin. */
  adminPrestasi: { students: number; answered: number; accuracy: number | null; entries: number }
  /** `GET /api/admin-sekolah/usage?period=30days`: XS-2 `activePupils` and the 30 day answers. */
  usage: {
    pupils: number
    teachers: number
    activePupils: number
    answers: number
    accuracy: number | null
  }
}

interface PerfSchool {
  stats: {
    students: number
    teachers: number
    sessions: number
    answered: number
    accuracy: number | null
  }
  gps: { entries: number }
}

async function schoolFigures(teacher: Page, admin: Page): Promise<SchoolFigures> {
  const dash = await call<{
    cards: { pupils: number; teachers: number }
    performance: {
      practice: { accuracy: number | null; sessions: number; questions: number }
      gps: { entries: number }
    }
  }>(admin, 'GET', '/api/admin-sekolah/dashboard')
  const t = await call<PerfSchool>(teacher, 'GET', '/api/performance/school')
  const a = await call<PerfSchool>(admin, 'GET', '/api/performance/school')
  const usage = await call<{
    tiles: {
      pupils: number
      teachers: number
      activePupils: number
      answers: number
      accuracy: number | null
    }
  }>(admin, 'GET', '/api/admin-sekolah/usage?period=30days')
  return {
    dash: {
      pupils: dash.cards.pupils,
      teachers: dash.cards.teachers,
      questions: dash.performance.practice.questions,
      sessions: dash.performance.practice.sessions,
      accuracy: dash.performance.practice.accuracy,
      entries: dash.performance.gps.entries,
    },
    teacher: {
      students: t.stats.students,
      teachers: t.stats.teachers,
      answered: t.stats.answered,
      sessions: t.stats.sessions,
      accuracy: t.stats.accuracy,
      entries: t.gps.entries,
    },
    adminPrestasi: {
      students: a.stats.students,
      answered: a.stats.answered,
      accuracy: a.stats.accuracy,
      entries: a.gps.entries,
    },
    usage: { ...usage.tiles },
  }
}

/** XS-1..XS-5 of the school: the school-admin dashboard equals the teacher screens of the same school (API values). */
function expectXsEqual(f: SchoolFigures, stage: string): void {
  const at = `[${stage}]`
  expect(f.dash.pupils, `${at} XS-1 dashboard cards.pupils = teacher Prestasi sekolah Murid`).toBe(
    f.teacher.students,
  )
  expect(f.dash.pupils, `${at} XS-1 dashboard = Penggunaan pupils`).toBe(f.usage.pupils)
  expect(
    f.dash.teachers,
    `${at} XS-3 dashboard cards.teachers = teacher Prestasi sekolah Guru`,
  ).toBe(f.teacher.teachers)
  expect(f.dash.teachers, `${at} XS-3 dashboard = Penggunaan teachers`).toBe(f.usage.teachers)
  expect(f.dash.questions, `${at} XS-4 dashboard questions = teacher Soalan Dijawab`).toBe(
    f.teacher.answered,
  )
  expect(f.dash.accuracy, `${at} XS-5 dashboard accuracy = teacher Purata Ketepatan`).toBe(
    f.teacher.accuracy,
  )
  expect(f.dash.sessions, `${at} dashboard sessions = teacher Sesi Latihan`).toBe(
    f.teacher.sessions,
  )
  expect(f.adminPrestasi.answered, `${at} XS-4 school-admin Prestasi = teacher`).toBe(
    f.teacher.answered,
  )
  expect(f.adminPrestasi.accuracy, `${at} XS-5 school-admin Prestasi = teacher`).toBe(
    f.teacher.accuracy,
  )
  expect(f.adminPrestasi.students, `${at} XS-1 school-admin Prestasi = teacher`).toBe(
    f.teacher.students,
  )
}

/** "{n} entri headcount": one count on the school-admin dashboard and on the Prestasi sekolah of both roles. */
function expectEntriesEqual(f: SchoolFigures, stage: string): number {
  const n = f.dash.entries
  expect(
    f.teacher.entries,
    `[${stage}] "{n} entri headcount": teacher Prestasi sekolah = school-admin dashboard`,
  ).toBe(n)
  expect(
    f.adminPrestasi.entries,
    `[${stage}] "{n} entri headcount": school-admin Prestasi sekolah = dashboard`,
  ).toBe(n)
  return n
}

// --- screens ---------------------------------------------------------------------------------------------------------------

/** The figures of one pupil's row of the teacher / school-admin table, in the table or in the card layout (below `md`). */
async function tableFigures(
  page: Page,
  pupilName: string,
  otrs: number,
): Promise<Record<string, number | null>> {
  const labels = [
    'TOV',
    ...Array.from({ length: otrs }, (_, i) => [`OTR${String(i + 1)}`, `AR${String(i + 1)}`]).flat(),
    'ETR',
  ]
  const raw = await page.getByTestId('headcount-table').evaluate(
    (root, args) => {
      const { name, names } = args
      const num = (t: string): string => t.replace(/\s*\(.*\)\s*$/, '').trim()
      const out: Record<string, string> = {}
      const card = [...root.querySelectorAll('[data-ds="data-table-cards"] > li')].find((li) =>
        li.textContent?.includes(name),
      )
      if (card) {
        for (const d of card.querySelectorAll('dl > div')) {
          const k = d.querySelector('dt')?.textContent?.trim()
          const v = d.querySelector('dd')?.textContent ?? ''
          if (k) out[k] = num(v)
        }
        return out
      }
      const tr = [...root.querySelectorAll('tbody tr')].find((r) => r.textContent?.includes(name))
      if (!tr) return out
      const cells = [...tr.querySelectorAll('td')].map((c) => c.textContent?.trim() ?? '')
      // [select |] # | Nama | TOV % | Gred | OTR1 % | Gred | AR1 % | Gred | ... | ETR % | Gred: counted from the Nama cell.
      const first = cells.findIndex((c) => c.includes(name)) + 1
      names.forEach((label, i) => {
        out[label] = cells[first + i * 2] ?? ''
      })
      return out
    },
    { name: pupilName, names: labels },
  )
  const out: Record<string, number | null> = {}
  for (const label of labels) {
    const v = raw[label]
    out[label] = v === undefined || v === '' || v === '—' ? null : Number(v)
  }
  return out
}

/** The pupil's own detail `/headcount/student/:id` (pupil, teacher or school admin). */
async function expectPupilSection(
  page: Page,
  cfg: string,
  want: {
    status: string
    keyakinan: string
    ar: number
    tones: ('on' | 'below')[]
    targets: number[]
    who: string
  },
): Promise<void> {
  const section = page.getByTestId(`section-${cfg}`)
  await expect(section, `${want.who}: detail section`).toBeVisible({ timeout: 20_000 })
  await expect(section.getByTestId('status-pill'), `${want.who}: status`).toContainText(want.status)
  await expect(section.getByTestId('chip-tov'), `${want.who}: TOV`).toContainText('TOV: 40.0%')
  await expect(section.getByTestId('chip-etr'), `${want.who}: ETR/RS`).toContainText('ETR: 80.0%')
  await expect(section.getByTestId('chip-confidence'), `${want.who}: Keyakinan`).toContainText(
    `Keyakinan: ${want.keyakinan}`,
  )
  const table = section.getByTestId(`table-${cfg}`)
  await expect(table, `${want.who}: checkpoint table`).toBeVisible()
  for (let i = 0; i < want.tones.length; i++) {
    // The checkpoint table carries the tone on its row marker; below `md` the table is a card list without it (the API
    // `rows[].tone` is asserted by the caller on every viewport).
    const marker = section.getByTestId(`row-otr-${String(i + 1)}`)
    if ((await marker.count()) > 0) {
      await expect(marker, `${want.who}: OTR${String(i + 1)} status`).toHaveAttribute(
        'data-tone',
        want.tones[i] as string,
      )
    }
  }
  const text = squash(await table.innerText())
  for (const t of want.targets)
    expect(text, `${want.who}: OTR target ${String(t)}`).toContain(`${t.toFixed(1)}`)
  expect(text, `${want.who}: AR ${String(want.ar)}`).toContain(`${want.ar.toFixed(1)}`)
}

// --- the chain -------------------------------------------------------------------------------------------------------------

// The one-time password of the new pupil goes through a response body: keep it out of artifacts (top level: `use` forces a worker).
test.use({ trace: 'off', screenshot: 'off', video: 'off' })

test.describe('AC-CHAIN-5 Headcount from key-in to every view', () => {
  test('@api the teacher sets Sains 4A TOV 40 / RS 80; 6 of 10 then 16 of 20 answers show one figure on every screen', async ({
    page: teacherPage,
    browser,
  }, info) => {
    test.setTimeout(420_000)
    const peers: Peer[] = []
    const open = async (): Promise<Peer> => {
      const p = await peer(browser, info)
      peers.push(p)
      return p
    }

    try {
      // ---------------------------------------------------------------------------------------------------------------
      // Setup (public API, seed roles): class 4A of Sains, a new pupil of Tingkatan 4 in it, an Auto config with 3 OTRs.
      // ---------------------------------------------------------------------------------------------------------------
      const stamp = `${Date.now().toString(36)}${info.project.name}`
      const className = ujiName(`Kelas 4A ${stamp}`)
      const pupilName = ujiName(`Murid ${stamp}`)
      const pupilEmail = `uji.chain5.${stamp}@example.test`

      await loginAs(teacherPage, 'guru')
      const adminSekolah = await open()
      await loginAs(adminSekolah.page, 'adminSekolah')
      const adminPusat = await open()
      await loginAs(adminPusat.page, 'adminPusat')

      const options = await call<{ subjects: { id: string; name: string; code: string }[] }>(
        teacherPage,
        'GET',
        '/api/headcounts/form-options',
      )
      const sains = options.subjects.find((s) => s.name === 'Sains')
      expect(sains, 'the seed has the subject Sains').toBeDefined()
      const cls = await call<{
        id: string
        schoolId: string
        levelId: string
        academicYear: number
        subjectName: string
      }>(teacherPage, 'POST', '/api/guru/classes', {
        name: className,
        subjectId: (sains as { id: string }).id,
        educationLevel: 'tingkatan-4',
      })
      expect(cls.subjectName).toBe('Sains')

      // The pupil: Tingkatan 4 (grade 10), so XS-1 counts it (a school-admin-created pupil has no grade, see FINDING-5).
      const created = await call<{ id: string; generatedPassword: string }>(
        adminPusat.page,
        'POST',
        '/api/admin/users',
        {
          name: pupilName,
          email: pupilEmail,
          roles: ['student'],
          grade: 10,
          schoolId: cls.schoolId,
        },
      )
      const pupilId = created.id
      const pupilPassword = created.generatedPassword
      expect(pupilPassword.length).toBeGreaterThan(0)
      await call(teacherPage, 'PUT', `/api/guru/students/${pupilId}`, { classroomId: cls.id })

      const config = await call<{ id: string }>(teacherPage, 'POST', '/api/headcounts', {
        classroomId: cls.id,
        subjectId: (sains as { id: string }).id,
        educationLevelId: cls.levelId,
        academicYear: cls.academicYear,
        activeOtrs: 3,
        mode: 'auto',
      })
      const cfg = config.id

      const pupil = await open()
      await loginViaUi(pupil.page, pupilEmail, pupilPassword)

      // Baselines (before the key-in and before any answer of the pupil).
      const base = await schoolFigures(teacherPage, adminSekolah.page)
      expectXsEqual(base, 'start')
      const entries0 = expectEntriesEqual(base, 'start')

      // ---------------------------------------------------------------------------------------------------------------
      await test.step('1. Teacher: Simpan Sasaran TOV 40 and RS 80 on the Auto config (Tetapan)', async () => {
        await teacherPage.goto(`/headcount/${cfg}/settings`)
        await expect(teacherPage.getByTestId('headcount-settings-page')).toBeVisible({
          timeout: 20_000,
        })
        await expect(teacherPage.getByTestId('mode-readonly')).toContainText('Auto')
        await teacherPage.getByTestId('target-tov').locator('input').fill('40')
        await teacherPage.getByTestId('target-rs').locator('input').fill('80')
        await expect(teacherPage.getByTestId('jurang'), 'Jurang before saving').toHaveText(
          'Jurang: +40',
        )
        const saved = teacherPage.waitForResponse(
          (r) =>
            r.url().includes(`/api/headcounts/${cfg}/defaults`) && r.request().method() === 'PUT',
          { timeout: 30_000 },
        )
        await teacherPage.getByTestId('target-save').click()
        expect((await saved).status(), 'PUT /api/headcounts/:id/defaults').toBe(200)
        await expect(teacherPage.getByText('Sasaran disimpan.').first()).toBeVisible()
        await expectNoHScroll(teacherPage)

        // The stored defaults: what every other screen reads.
        const detail = await call<ConfigDetail>(teacherPage, 'GET', `/api/headcounts/${cfg}`)
        expect(detail.config.mode).toBe('auto')
        expect(detail.config.activeOtrs).toBe(3)
        expect(detail.config.defaultTov).toBe(40)
        expect(detail.config.defaultEtr).toBe(80)
        await teacherPage.reload()
        await expect(teacherPage.getByTestId('jurang'), 'Jurang after reload (stored)').toHaveText(
          'Jurang: +40',
        )
      })

      // ---------------------------------------------------------------------------------------------------------------
      // The pupil answers through the real practice flow: start, check each answer, submit. The key is read as Admin Pusat
      // from the question bank, so the number of correct answers is exact.
      // ---------------------------------------------------------------------------------------------------------------
      const answerBatch = async (correct: number): Promise<void> => {
        const session = await call<{
          sessionId: string
          subject: { name: string }
          questions: { id: string; options: { id: number; label: string }[] }[]
        }>(pupil.page, 'POST', '/api/practice/sessions', {
          mode: 'latih_tubi',
          subjectCode: (sains as { code: string }).code,
          levelId: cls.levelId,
          count: 10,
        })
        expect(session.subject.name).toBe('Sains')
        expect(session.questions).toHaveLength(10)
        let right = 0
        for (const q of session.questions) {
          const bank = await call<{ parts: { key: { correct: string } }[] }>(
            adminPusat.page,
            'GET',
            `/api/questions/${q.id}`,
          )
          const key = bank.parts[0]?.key.correct
          const rightOption = q.options.find((o) => o.label === key)
          const wrongOption = q.options.find((o) => o.label !== key)
          expect(
            rightOption && wrongOption,
            `question ${q.id} has a key and a distractor`,
          ).toBeTruthy()
          const pick = right < correct ? rightOption : wrongOption
          right += 1
          const checked = await call<{ isCorrect: boolean }>(
            pupil.page,
            'POST',
            `/api/practice/sessions/${session.sessionId}/check-answer`,
            {
              questionId: q.id,
              selectedOptionId: (pick as { id: number }).id,
            },
          )
          expect(checked.isCorrect).toBe(pick === rightOption)
        }
        const done = await call<{ results: { score: number; total: number } }>(
          pupil.page,
          'POST',
          `/api/practice/sessions/${session.sessionId}/submit`,
          { timeSpent: 60 },
        )
        expect(done.results).toMatchObject({ score: correct, total: 10 })
      }

      await test.step('2. Pupil: 10 Sains answers, 6 correct, through the practice flow', async () => {
        await answerBatch(6)
        // The rows landed in practice_answers by the normal path: the pupil's Prestasi pool (all modes) reads them.
        const own = await call<{ stats: { answered: number; accuracy: number | null } }>(
          adminSekolah.page,
          'GET',
          `/api/performance/students/${pupilId}`,
        )
        expect(own.stats.answered).toBe(10)
        expect(own.stats.accuracy).toBe(60)
      })

      // ---------------------------------------------------------------------------------------------------------------
      await test.step('3a. Teacher table: OTR1 53, OTR2 66, OTR3 80, AR 60, pupil status Below', async () => {
        const detail = await call<ConfigDetail>(teacherPage, 'GET', `/api/headcounts/${cfg}`)
        const row = detail.rows.find((r) => r.userId === pupilId)
        expect(row, 'the pupil is on the roster').toBeDefined()
        expect(
          row?.cells.map((c) => c.target),
          'API OTR1..3',
        ).toEqual([53, 66, 80])
        expect(
          row?.cells.map((c) => c.ar),
          'API AR at every checkpoint',
        ).toEqual([60, 60, 60])
        expect(row?.status, 'API pupil status').toBe('below')
        expect(detail.chips).toMatchObject({ onTrack: 0, below: 1, total: 1 })

        await teacherPage.goto(`/headcount/${cfg}`)
        await expect(teacherPage.getByTestId('headcount-table-page')).toBeVisible({
          timeout: 20_000,
        })
        await expect(teacherPage.getByTestId('headcount-table')).toBeVisible()
        expect(await tableFigures(teacherPage, pupilName, 3)).toEqual({
          TOV: 40,
          OTR1: 53,
          AR1: 60,
          OTR2: 66,
          AR2: 60,
          OTR3: 80,
          AR3: 60,
          ETR: 80,
        })
        await expect(teacherPage.getByTestId('chip-below'), 'teacher chip Below').toContainText(
          'Below: 1',
        )
        await expect(teacherPage.getByTestId('chip-on'), 'teacher chip On Track').toContainText(
          'On Track: 0',
        )
        // Former FINDING-1 (fixed by #1065): the teacher table shows "Jurang +40".
        await expect(
          teacherPage.getByTestId('chip-jurang'),
          'teacher table shows "Jurang +40"',
        ).toContainText('Jurang: +40')
        await expectNoHScroll(teacherPage)
      })

      await test.step('3b. Pupil /headcount card reads Active; the detail shows the same targets, AR 60, Sederhana, Below', async () => {
        const own = await call<PupilSection[] | { id: string; entryStatus: string }[]>(
          pupil.page,
          'GET',
          '/api/headcounts/me',
        )
        expect(own).toHaveLength(1)
        expect((own as { id: string; entryStatus: string }[])[0]).toMatchObject({
          id: cfg,
          entryStatus: 'active',
        })

        await pupil.page.goto('/headcount')
        await expect(pupil.page.getByTestId('headcount-murid-page')).toBeVisible({
          timeout: 20_000,
        })
        await expect(pupil.page.getByTestId(`headcount-pill-${cfg}`)).toHaveText('Active')
        await expect(pupil.page.getByTestId(`headcount-mode-${cfg}`)).toContainText('Auto')
        await expect(pupil.page.getByTestId(`headcount-card-${cfg}`)).toContainText(className)
        await expectNoHScroll(pupil.page)

        const detail = await call<{ sections: PupilSection[] }>(
          pupil.page,
          'GET',
          `/api/headcounts/me/detail?configId=${cfg}`,
        )
        const s = detail.sections[0] as PupilSection
        expect(s).toMatchObject({
          status: 'below',
          entryStatus: 'active',
          jurang: 40,
          keyakinan: 'Sederhana',
          tov: 40,
          etr: 80,
        })
        expect(s.rows.map((r) => [r.target, r.ar, r.tone])).toEqual([
          [53, 60, 'on'],
          [66, 60, 'below'],
          [80, 60, 'below'],
        ])

        await pupil.page.getByTestId(`headcount-open-${cfg}`).click()
        await expect(pupil.page).toHaveURL(new RegExp(`/headcount/student/${pupilId}(\\?|$)`))
        await expect(pupil.page.getByTestId('headcount-student-page')).toBeVisible({
          timeout: 20_000,
        })
        await expectPupilSection(pupil.page, cfg, {
          who: 'pupil',
          status: 'Below',
          keyakinan: 'Sederhana',
          ar: 60,
          tones: ['on', 'below', 'below'],
          targets: [53, 66, 80],
        })
        await expect(pupil.page.getByTestId('entry-pill')).toHaveText('Active')
        await expect(pupil.page.getByTestId('chip-jurang')).toContainText('Jurang: +40')
        // Former FINDING-2 (fixed by #1065): "Belum capai sasaran" (AR 60 < RS 80, AC-MUR-3-2) on the pupil's detail.
        await expect(
          pupil.page.getByTestId('chip-goal'),
          'pupil detail says "Belum capai sasaran"',
        ).toHaveText('Belum capai sasaran')
        await expectNoHScroll(pupil.page)
      })

      await test.step('3c. School admin: read-only list and pupil view show Below; the Prestasi pill shows Below', async () => {
        const list = await call<
          { id: string; className: string; mode: string; students: number; teacherName: string }[]
        >(adminSekolah.page, 'GET', '/api/headcounts')
        expect(
          list.find((c) => c.id === cfg),
          'the school admin lists the teacher config',
        ).toMatchObject({
          className,
          mode: 'auto',
          students: 1,
        })

        await adminSekolah.page.goto('/headcount')
        await expect(adminSekolah.page.getByTestId('headcount-list-page')).toBeVisible({
          timeout: 20_000,
        })
        await expect(
          adminSekolah.page.getByTestId('hero-create'),
          'read-only: no Buat Baru',
        ).toHaveCount(0)
        await expect(
          adminSekolah.page.getByTestId('hero-auto-setup'),
          'read-only: no Auto-Setup',
        ).toHaveCount(0)
        const listText = squash(await adminSekolah.page.getByTestId('headcount-list').innerText())
        for (const part of [className, 'Sains', 'Auto', '3 OTR', '1 murid'])
          expect(listText).toContain(part)
        await expectNoHScroll(adminSekolah.page)

        await adminSekolah.page.goto(`/headcount/${cfg}`)
        await expect(adminSekolah.page.getByTestId('headcount-table')).toBeVisible({
          timeout: 20_000,
        })
        expect(await tableFigures(adminSekolah.page, pupilName, 3)).toEqual({
          TOV: 40,
          OTR1: 53,
          AR1: 60,
          OTR2: 66,
          AR2: 60,
          OTR3: 80,
          AR3: 60,
          ETR: 80,
        })
        await expect(
          adminSekolah.page.getByTestId('chip-below'),
          'school admin chip Below',
        ).toContainText('Below: 1')
        await expect(
          adminSekolah.page.getByTestId('action-key-in'),
          'read-only: no Key-in',
        ).toHaveCount(0)

        await adminSekolah.page.goto(`/headcount/student/${pupilId}`)
        // Former FINDING-6 (fixed by #1066): the staff pupil page lists the Auto pupil's class config without an entry row.
        await expectPupilSection(adminSekolah.page, cfg, {
          who: 'school admin',
          status: 'Below',
          keyakinan: 'Sederhana',
          ar: 60,
          tones: ['on', 'below', 'below'],
          targets: [53, 66, 80],
        })
        await expectNoHScroll(adminSekolah.page)

        // The Prestasi Headcount pill: the pupil's own Prestasi 360.
        await pupil.page.goto('/prestasi')
        const pill = pupil.page.getByTestId(`headcount-${cfg}`).getByTestId('status-pill')
        await expect(pill, 'Prestasi Headcount pill (pupil)').toHaveText('Below')
        await expect(
          pupil.page.getByTestId(`headcount-${cfg}`).getByTestId('chip-row'),
        ).toContainText('OTR1: 60%')
        await expectNoHScroll(pupil.page)

        // Former FINDING-3 (fixed by #1066): the staff view of the pupil's Prestasi shows the Headcount pill.
        await adminSekolah.page.goto(`/prestasi/${pupilId}`)
        await expect(adminSekolah.page.getByTestId('hero')).toBeVisible({ timeout: 20_000 })
        await expect(
          adminSekolah.page.getByTestId(`headcount-${cfg}`).getByTestId('status-pill'),
          'school admin Prestasi of the pupil shows the Headcount pill Below',
        ).toHaveText('Below', { timeout: 20_000 })
      })

      let entries1 = 0
      await test.step('3d. "{n} entri headcount" is one count on every screen; the school figures XS-1..XS-5 agree', async () => {
        const f = await schoolFigures(teacherPage, adminSekolah.page)
        expectXsEqual(f, 'after 10 answers')
        entries1 = expectEntriesEqual(f, 'after 10 answers')
        expect(entries1, 'the graded pupil adds exactly one headcount entry').toBe(entries0 + 1)
        expect(f.teacher.answered, 'XS-4: +10 answers').toBe(base.teacher.answered + 10)
        expect(f.dash.questions, 'XS-4: +10 answers on the dashboard').toBe(
          base.dash.questions + 10,
        )
        expect(f.usage.activePupils, 'XS-2: the pupil is one more active pupil').toBe(
          base.usage.activePupils + 1,
        )
        expect(f.usage.answers, 'XS-4 in the 30 day window: +10').toBe(base.usage.answers + 10)
        expect(f.dash.pupils, 'XS-1 unchanged by answering').toBe(base.dash.pupils)

        // The same figures as the screens show them.
        await adminSekolah.page.goto('/admin-sekolah')
        await expect(adminSekolah.page.getByTestId('sd-cards')).toBeVisible({ timeout: 20_000 })
        expect(
          numberBefore(
            await adminSekolah.page.getByTestId('sd-cards').innerText(),
            'Jumlah Pelajar',
          ),
        ).toBe(f.dash.pupils)
        expect(
          numberBefore(await adminSekolah.page.getByTestId('sd-cards').innerText(), 'Jumlah Guru'),
        ).toBe(f.dash.teachers)
        await expect(adminSekolah.page.getByTestId('sd-practice-accuracy')).toHaveText(
          shownAccuracy(f.dash.accuracy),
        )
        await expect(adminSekolah.page.getByTestId('sd-practice-counts')).toContainText(
          `${grouped(f.dash.sessions)} sesi · ${grouped(f.dash.questions)} soalan`,
        )
        await expect(adminSekolah.page.getByTestId('sd-gps-entries')).toContainText(
          `${String(entries1)} entri headcount`,
        )
        await expectNoHScroll(adminSekolah.page)

        for (const [who, p] of [
          ['school admin', adminSekolah.page],
          ['teacher', teacherPage],
        ] as const) {
          await p.goto('/prestasi/sekolah')
          await expect(p.getByTestId('stat-cards'), `${who}: Prestasi sekolah`).toBeVisible({
            timeout: 20_000,
          })
          const tiles = await p.getByTestId('stat-cards').innerText()
          expect(numberBefore(tiles, 'Murid'), `${who}: Murid`).toBe(f.dash.pupils)
          expect(numberBefore(tiles, 'Guru'), `${who}: Guru`).toBe(f.dash.teachers)
          expect(numberBefore(tiles, 'Soalan Dijawab'), `${who}: Soalan Dijawab`).toBe(
            f.dash.questions,
          )
          expect(squash(tiles), `${who}: Purata Ketepatan`).toContain(
            `${shownAccuracy(f.dash.accuracy)} Purata Ketepatan`,
          )
          await expect(p.getByTestId('gps-entries'), `${who}: "{n} entri headcount"`).toHaveText(
            String(entries1),
          )
          await expectNoHScroll(p)
        }
      })

      // ---------------------------------------------------------------------------------------------------------------
      let onTrackBefore = 0
      let offTrackBefore = 0
      await test.step('4a. Before the second batch: the teacher On Track counts (Dashboard Headcount, class dashboard)', async () => {
        const dash = await call<{ configs: { id: string; onTrack: number; offTrack: number }[] }>(
          teacherPage,
          'GET',
          '/api/headcounts/dashboard',
        )
        onTrackBefore = dash.configs.reduce((n, c) => n + c.onTrack, 0)
        offTrackBefore = dash.configs.reduce((n, c) => n + c.offTrack, 0)
        expect(dash.configs.find((c) => c.id === cfg)).toMatchObject({ onTrack: 0, offTrack: 1 })

        await teacherPage.goto('/headcount/dashboard')
        await expect(teacherPage.getByTestId('stat-cards')).toBeVisible({ timeout: 20_000 })
        expect(
          numberBefore(await teacherPage.getByTestId('stat-cards').innerText(), 'On Track'),
          'Dashboard Headcount On Track',
        ).toBe(onTrackBefore)
        expect(
          numberBefore(await teacherPage.getByTestId('stat-cards').innerText(), 'Off Track'),
          'Dashboard Headcount Off Track',
        ).toBe(offTrackBefore)

        await teacherPage.goto(`/prestasi/kelas/${cls.id}`)
        await expect(teacherPage.getByTestId('headcount-block')).toBeVisible({ timeout: 20_000 })
        await expect(teacherPage.getByTestId('hc-on'), 'class dashboard On Track').toContainText(
          '0',
        )
        await expect(teacherPage.getByTestId('hc-below'), 'class dashboard Below').toContainText(
          '1',
        )
        await expectNoHScroll(teacherPage)
      })

      await test.step('5. Pupil: 10 more Sains answers, all correct (16 of 20)', async () => {
        await answerBatch(10)
        const own = await call<{ stats: { answered: number; accuracy: number | null } }>(
          adminSekolah.page,
          'GET',
          `/api/performance/students/${pupilId}`,
        )
        expect(own.stats.answered).toBe(20)
        expect(own.stats.accuracy, 'pooled 16 of 20').toBe(80)
      })

      await test.step('6a. Teacher table and class figures: AR 80, pupil On Track, On Track +1 on both dashboards', async () => {
        const detail = await call<ConfigDetail>(teacherPage, 'GET', `/api/headcounts/${cfg}`)
        const row = detail.rows.find((r) => r.userId === pupilId)
        expect(row?.cells.map((c) => c.target)).toEqual([53, 66, 80])
        expect(row?.cells.map((c) => c.ar)).toEqual([80, 80, 80])
        expect(row?.status).toBe('on')
        expect(row?.projection?.confidence).toBe('Tinggi')
        expect(detail.chips).toMatchObject({ onTrack: 1, below: 0, total: 1 })

        await teacherPage.goto(`/headcount/${cfg}`)
        await expect(teacherPage.getByTestId('headcount-table')).toBeVisible({ timeout: 20_000 })
        expect(await tableFigures(teacherPage, pupilName, 3)).toEqual({
          TOV: 40,
          OTR1: 53,
          AR1: 80,
          OTR2: 66,
          AR2: 80,
          OTR3: 80,
          AR3: 80,
          ETR: 80,
        })
        await expect(teacherPage.getByTestId('chip-on')).toContainText('On Track: 1')
        await expect(teacherPage.getByTestId('chip-below')).toContainText('Below: 0')

        const dash = await call<{ configs: { id: string; onTrack: number; offTrack: number }[] }>(
          teacherPage,
          'GET',
          '/api/headcounts/dashboard',
        )
        expect(
          dash.configs.reduce((n, c) => n + c.onTrack, 0),
          'API Dashboard Headcount On Track is +1',
        ).toBe(onTrackBefore + 1)
        expect(
          dash.configs.reduce((n, c) => n + c.offTrack, 0),
          'API Dashboard Headcount Off Track is -1',
        ).toBe(offTrackBefore - 1)

        await teacherPage.goto('/headcount/dashboard')
        await expect(teacherPage.getByTestId('stat-cards')).toBeVisible({ timeout: 20_000 })
        expect(
          numberBefore(await teacherPage.getByTestId('stat-cards').innerText(), 'On Track'),
          'Dashboard Headcount On Track +1',
        ).toBe(onTrackBefore + 1)
        expect(
          numberBefore(await teacherPage.getByTestId('stat-cards').innerText(), 'Off Track'),
          'Dashboard Headcount Off Track -1',
        ).toBe(offTrackBefore - 1)
        await expectNoHScroll(teacherPage)

        await teacherPage.goto(`/prestasi/kelas/${cls.id}`)
        await expect(teacherPage.getByTestId('headcount-block')).toBeVisible({ timeout: 20_000 })
        await expect(teacherPage.getByTestId('hc-on'), 'class dashboard On Track +1').toContainText(
          '1',
        )
        await expect(teacherPage.getByTestId('hc-below'), 'class dashboard Below').toContainText(
          '0',
        )
        await expectNoHScroll(teacherPage)
      })

      await test.step('6b. Pupil and school admin: AR 80, On Track, Tinggi; the Prestasi pill is On Track', async () => {
        const detail = await call<{ sections: PupilSection[] }>(
          pupil.page,
          'GET',
          `/api/headcounts/me/detail?configId=${cfg}`,
        )
        expect(detail.sections[0]).toMatchObject({
          status: 'on',
          entryStatus: 'active',
          jurang: 40,
          keyakinan: 'Tinggi',
        })
        expect(detail.sections[0]?.rows.map((r) => [r.target, r.ar, r.tone])).toEqual([
          [53, 80, 'on'],
          [66, 80, 'on'],
          [80, 80, 'on'],
        ])
        for (const [who, p] of [
          ['pupil', pupil.page],
          ['school admin', adminSekolah.page],
        ] as const) {
          await p.goto(`/headcount/student/${pupilId}`)
          await expectPupilSection(p, cfg, {
            who,
            status: 'On Track',
            keyakinan: 'Tinggi',
            ar: 80,
            tones: ['on', 'on', 'on'],
            targets: [53, 66, 80],
          })
          await expectNoHScroll(p)
        }
        await pupil.page.goto('/headcount')
        await expect(pupil.page.getByTestId(`headcount-pill-${cfg}`)).toHaveText('Active')

        await pupil.page.goto('/prestasi')
        await expect(
          pupil.page.getByTestId(`headcount-${cfg}`).getByTestId('status-pill'),
          'Prestasi Headcount pill',
        ).toHaveText('On Track')

        await adminSekolah.page.goto(`/headcount/${cfg}`)
        await expect(adminSekolah.page.getByTestId('headcount-table')).toBeVisible({
          timeout: 20_000,
        })
        expect((await tableFigures(adminSekolah.page, pupilName, 3)).AR3, 'school admin AR3').toBe(
          80,
        )
        await expect(adminSekolah.page.getByTestId('chip-on')).toContainText('On Track: 1')
      })

      await test.step('7. After 16 of 20: "{n} entri headcount" unchanged and equal everywhere; XS-1..XS-5 still agree', async () => {
        const f = await schoolFigures(teacherPage, adminSekolah.page)
        expectXsEqual(f, 'after 20 answers')
        const entries2 = expectEntriesEqual(f, 'after 20 answers')
        expect(entries2, 'a second batch of answers adds no entry').toBe(entries1)
        expect(f.teacher.answered, 'XS-4: +20 answers').toBe(base.teacher.answered + 20)
        expect(f.dash.questions).toBe(base.dash.questions + 20)
        expect(f.usage.activePupils, 'XS-2 still one more active pupil').toBe(
          base.usage.activePupils + 1,
        )
        expect(f.usage.answers, 'XS-4 in the 30 day window: +20').toBe(base.usage.answers + 20)

        await adminSekolah.page.goto('/admin-sekolah')
        await expect(adminSekolah.page.getByTestId('sd-practice-accuracy')).toHaveText(
          shownAccuracy(f.dash.accuracy),
          { timeout: 20_000 },
        )
        await expect(adminSekolah.page.getByTestId('sd-practice-counts')).toContainText(
          `${grouped(f.dash.sessions)} sesi · ${grouped(f.dash.questions)} soalan`,
        )
        await expect(adminSekolah.page.getByTestId('sd-gps-entries')).toContainText(
          `${String(entries2)} entri headcount`,
        )
        await teacherPage.goto('/prestasi/sekolah')
        await expect(teacherPage.getByTestId('stat-cards')).toBeVisible({ timeout: 20_000 })
        expect(
          numberBefore(await teacherPage.getByTestId('stat-cards').innerText(), 'Soalan Dijawab'),
        ).toBe(f.dash.questions)
        expect(squash(await teacherPage.getByTestId('stat-cards').innerText())).toContain(
          `${shownAccuracy(f.dash.accuracy)} Purata Ketepatan`,
        )
        await expect(teacherPage.getByTestId('gps-entries')).toHaveText(String(entries2))
      })
    } finally {
      for (const p of peers) await p.context.close().catch(() => undefined)
    }
  })
})
