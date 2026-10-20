/**
 * US-33 (b): Bijak results reach the Guru modules and the school dashboard (AC-33.4), and
 * Mod Pelajar data is excluded (AC-33.5). The UI is built on `be/us33-ui` (not on origin yet), so
 * every test is a `test.fixme` with its steps written; wire the TODO selectors in `us33-flow.ts`
 * and drop the fixme. Needs the scope-ON build: `npm run test:e2e:bijak`.
 */
import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll } from '../support'
import { HTTP_MODE, startPaper, submitAttempt, pickOption } from './bijak-flow'
import { US33_ACCOUNTS, US33_ROUTES, US33_SELECTORS, readBlock } from './us33-flow'

test.skip(
  HTTP_MODE,
  'mock-only (loginAs init-script session, __mock boot, local mock server): not run when BIJAK_API_BASE is set',
)
test.skip(
  process.env.E2E_PROTOTYPE_SCOPE !== 'on',
  'needs the scope-on build: playwright.bijak.config.mjs',
)

test.describe('Bijak SPM US-33 results in Guru and school views @bijak', () => {
  test.fixme('school admin sees the school Bijak results block on the dashboard @bijak', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    // FIXME(be/us33-ui): the school dashboard has no Bijak block yet and the contract defines no
    // Bijak field (BE-21 SchoolAdminDashboardSchema). Expect attempts, average percent, per-paper rows.
    await loginAs(US33_ACCOUNTS.schoolAdmin)
    await gotoApp(US33_ROUTES.schoolDashboard)
    await expectNoHorizontalScroll(page)
    const block = await readBlock(page, US33_SELECTORS.schoolBlock)
    expect(block.attempts).toBeGreaterThanOrEqual(0)
  })

  test.fixme('teacher sees Bijak results of own students only (no other class or school) @bijak', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    // FIXME(be/us33-ui): Prestasi / Analitik show no Bijak results yet. Scoping: every student
    // listed belongs to the teacher's class(es); students of other classes or schools are absent.
    await loginAs(US33_ACCOUNTS.teacher)
    await gotoApp(US33_ROUTES.teacherAnalitikKelas)
    await expectNoHorizontalScroll(page)
    await readBlock(page, US33_SELECTORS.teacherBlock)
    // TODO: assert student names against the teacher's class roster (m10 fixtures) and that a
    // known other-school student is not listed.
  })

  test.fixme('a submitted student attempt shows up in the teacher and school admin views @bijak', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    // FIXME(be/us33-ui): needs the UI. Wiring note: the mock Bijak store lives in the tab's
    // localStorage and `loginAs` can only be called once per page, so switching role may need the
    // `actAs` helper (e2e/support/act-as.ts) or one context driven by in-app navigation.
    await loginAs(US33_ACCOUNTS.student)
    await gotoApp('/spm/bijak')
    await startPaper(page)
    await pickOption(page, 0)
    await submitAttempt(page)
    // TODO: switch to the teacher, read attempts before/after (+1), then the school admin (+1).
  })

  test.fixme('Mod Pelajar attempts are excluded from school and teacher figures (AC-33.5) @bijak', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    // FIXME(be/us33-ui): needs the UI. Steps: admin enters Mod Pelajar (see admin-mod-pelajar.spec.ts),
    // submits a Bijak attempt, leaves, then the school and teacher attempt counts must not change.
    await loginAs(US33_ACCOUNTS.admin)
    await gotoApp(US33_ROUTES.schoolDashboard)
    await expectNoHorizontalScroll(page)
  })
})
