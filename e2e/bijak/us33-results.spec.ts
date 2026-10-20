/**
 * US-33 (b): Bijak results reach the Guru modules and the school dashboard through the EXISTING
 * performance fields (no new contract fields; "Bijak" is the data source plus a UI label), and
 * Mod Pelajar data is excluded (AC-33.5). The UI is built on `be/us33-ui` (not on origin yet), so
 * every test is a `test.fixme` with its steps written; wire the TODO selectors in `us33-flow.ts`
 * and drop the fixme. Needs the scope-ON build: `npm run test:e2e:bijak`.
 */
import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll } from '../support'
import { HTTP_MODE, pickOption, startPaper, submitAttempt } from './bijak-flow'
import {
  US33_ACCOUNTS,
  US33_ROUTES,
  US33_SELECTORS as S,
  expectBijakBlock,
  readStat,
} from './us33-flow'

test.skip(
  HTTP_MODE,
  'mock-only (loginAs init-script session, __mock boot, local mock server): not run when BIJAK_API_BASE is set',
)
test.skip(
  process.env.E2E_PROTOTYPE_SCOPE !== 'on',
  'needs the scope-on build: playwright.bijak.config.mjs',
)

test.describe('Bijak SPM US-33 results in Guru and school views @bijak', () => {
  test.fixme('school admin sees the Bijak-labelled performance block on the dashboard @bijak', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    // FIXME(be/us33-ui): the dashboard has no "Bijak" label yet. Fields: SchoolAdminDashboard
    // .performance.{practice.sessions, practice.questions, practice.accuracy, levels, distribution, total}.
    await loginAs(US33_ACCOUNTS.schoolAdmin)
    await gotoApp(US33_ROUTES.schoolDashboard)
    await expectBijakBlock(page, S.schoolPerformance)
    expect(await readStat(page, S.schoolPerformance, S.sessions)).toBeGreaterThan(0)
    expect(await readStat(page, S.schoolPerformance, S.accuracy)).toBeLessThanOrEqual(100)
    await expect(page.locator(S.schoolPerformance).locator(S.levels)).toBeVisible()
    await expect(page.locator(S.schoolPerformance).locator(S.distribution)).toBeVisible()
  })

  test.fixme('teacher sees reports figures for own students only @bijak', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    // FIXME(be/us33-ui): Prestasi / Analitik show no Bijak-labelled figures yet. Fields:
    // PerformanceSchool.{stats.sessions, stats.answered, stats.accuracy, levels, distribution}
    // and PerformanceClassAnalytics.rows (per student: accuracy, answered).
    await loginAs(US33_ACCOUNTS.teacher)
    await gotoApp(US33_ROUTES.teacherAnalitikKelas)
    await expectBijakBlock(page, S.teacherReports)
    expect(await readStat(page, S.teacherReports, S.sessions)).toBeGreaterThan(0)
    expect(await readStat(page, S.teacherReports, S.answered)).toBeGreaterThan(0)
    // TODO: every S.studentRow name belongs to the teacher class roster (m10 fixtures); a known
    // student of another class or school is not listed.
    await expect(page.locator(S.studentRow).first()).toBeVisible()
  })

  test.fixme('a submitted student attempt moves sessions and answered in both views @bijak', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    // FIXME(be/us33-ui): needs the UI. After one submit with n answered questions expect
    // sessions +1 and answered +n (teacher: PerformanceSchool.stats; school admin:
    // performance.practice.sessions / .questions). Wiring: the mock Bijak store lives in the tab
    // localStorage and `loginAs` works once per page, so role switching may need `actAs`
    // (e2e/support/act-as.ts) or in-app navigation in one context.
    await loginAs(US33_ACCOUNTS.student)
    await gotoApp('/spm/bijak')
    await startPaper(page)
    await pickOption(page, 0)
    await submitAttempt(page)
    // TODO: read sessions/answered before and after as teacher, then as school admin.
  })

  test.fixme('Mod Pelajar attempts do not move the school or teacher figures (AC-33.5) @bijak', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    // FIXME(be/us33-ui): needs the UI. Steps: admin enters Mod Pelajar (see admin-mod-pelajar.spec.ts),
    // submits a Bijak attempt, leaves; sessions and answered must be unchanged for school and teacher.
    await loginAs(US33_ACCOUNTS.admin)
    await gotoApp(US33_ROUTES.schoolDashboard)
    await expectNoHorizontalScroll(page)
  })

  test.fixme('a school or teacher with no Bijak attempts sees the no-data state @bijak', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    // FIXME(be/us33-ui): needs the UI no-data state. Expect S.noData instead of zeros
    // (contract: practice.accuracy is null, never 0%, when there are no sessions), no crash.
    await loginAs(US33_ACCOUNTS.schoolAdmin)
    await gotoApp(US33_ROUTES.schoolDashboard)
    await expect(page.locator(S.noData)).toBeVisible()
    await expectNoHorizontalScroll(page)
  })
})
