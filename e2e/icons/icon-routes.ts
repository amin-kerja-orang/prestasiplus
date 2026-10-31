/** Shared by the mock and the `@api` icon specs (D-09): the menu routes per role and the watchers. */
import type { Page } from '@playwright/test'

import { PENTADBIRAN_MENU } from '../../src/shells/pentadbiran/menu'
import { ICON_NOT_BUNDLED, ICONIFY_API_HOSTS, KNOWN_ABSENT_ICONS } from '../../src/theme/icon-hosts'

/**
 * Menu routes of each role, one per menu item of `src/app/prototype-scope.ts` (section A account items
 * + the role's section B; the first path rule of each item). Literal, because the e2e project cannot
 * import code that uses the `@/` alias; a unit test (`src/theme/__tests__/icon-offline.test.ts`)
 * keeps these lists in step with the matrix. Admin Pusat: every built row of the Pentadbiran menu.
 */
const ACCOUNT = ['/profile', '/tetapan', '/panduan', '/pusat-tuisyen/tiket']

export const ICON_ROUTES = {
  student: [
    ...ACCOUNT,
    ...['/dashboard', '/headcount', '/prestasi', '/analitik', '/analisa-item', '/video', '/kelas-saya'],
    ...['/practice/chapter', '/remedial', '/spm', '/buku-nota/heatmap', '/practice'],
    ...['/latihan-berstruktur', '/ranking', '/pksk', '/artikel', '/permainan', '/cabutan', '/tournament'],
    ...['/topics', '/peta-belajar', '/set-soalan-saya', '/audio-kbat', '/gamification'],
    ...['/gamification/convert', '/gamification/challenges', '/gamification/rewards', '/marketplace'],
    ...['/gamification/leaderboard', '/gamification/achievements', '/gamification/mystery-box'],
    ...['/gamification/referral', '/cikgu/hadiah', '/timeline', '/jemput-ibu-bapa'],
    ...(process.env.VITE_ALESA_AI === 'on' ? ['/cikgu'] : []),
    ...(process.env.VITE_KELUARGA_ANGKAT === 'on' ? ['/mohon-keluarga-angkat'] : []),
  ],
  teacher: [
    ...ACCOUNT,
    ...['/guru/command-center', '/guru', '/headcount', '/prestasi', '/analitik', '/analisa-item', '/video'],
    ...['/guru/kelas', '/practice/chapter', '/guru/monitoring', '/guru/kirkpatrick', '/guru/pelajar'],
    ...['/guru/laporan', '/guru/laporan-mingguan-kelas', '/guru/soalan'],
  ],
  school_admin: [
    ...ACCOUNT,
    ...['/admin-sekolah/command-center', '/admin-sekolah', '/headcount', '/prestasi', '/analitik'],
    ...['/analisa-item', '/video', '/admin-sekolah/monitoring', '/admin-sekolah/kirkpatrick'],
    ...['/sekolah-bersaing', '/admin-sekolah/statistik-penggunaan', '/admin-sekolah/dskp-heatmap'],
    ...['/admin-sekolah/laporan-aktiviti', '/amaran/sekolah', '/admin-sekolah/laporan-bulanan'],
    ...['/admin-sekolah/pelajar', '/admin-sekolah/guru', '/admin-sekolah/kelas'],
  ],
  admin: ['/admin', ...PENTADBIRAN_MENU.flatMap((g) => g.items.map((i) => i.to))],
} as const

/** Records icon-API requests and not-bundled warnings of a page (known-absent Phosphor names excluded). */
export function watchIcons(page: Page): string[] {
  const seen: string[] = []
  // With the guard installed the loader fails in-page and never sends a request, so this watcher only
  // catches a removed guard; the console warnings below are the main signal.
  page.on('request', (r) => {
    if (ICONIFY_API_HOSTS.some((h) => r.url().includes(h))) seen.push(`request ${r.url()}`)
  })
  page.on('console', (m) => {
    const t = m.text()
    if (t.includes(ICON_NOT_BUNDLED) && !KNOWN_ABSENT_ICONS.some((n) => t.endsWith(n))) seen.push(t)
  })
  return seen
}

/**
 * In-app navigation through the router (no page reload), then a short settle. Returns the horizontal
 * overflow in px (`scrollWidth - clientWidth`) of the page.
 */
export async function visit(page: Page, path: string): Promise<number> {
  await page.evaluate(async (to) => {
    const app = document.querySelector('#app') as
      | (Element & {
          __vue_app__?: { config: { globalProperties: { $router: { push: (p: string) => Promise<unknown> } } } }
        })
      | null
    await app?.__vue_app__?.config.globalProperties.$router.push(to)
  }, path)
  // The route chunk and its icons load after navigation: wait for the network to go quiet, then give the
  // icon loader its tick (a fixed wait alone could miss a late loader tick on a slow runner).
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(350)
  // A page can overflow for a moment while its enter transition or late layout settles: re-measure a few
  // times and report only an overflow that persists (a real one stays after ~2 s).
  const overflow = (): Promise<number> =>
    page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  let px = await overflow()
  for (let i = 0; i < 4 && px > 0; i += 1) {
    await page.waitForTimeout(500)
    px = await overflow()
  }
  return px
}

/** Visits every route; returns the paths that scroll horizontally. */
export async function visitAll(page: Page, routes: readonly string[]): Promise<string[]> {
  const overflowing: string[] = []
  for (const path of new Set(routes)) {
    const overflow = await visit(page, path)
    if (overflow > 0) overflowing.push(`${path} (+${String(overflow)}px)`)
  }
  return overflowing
}
