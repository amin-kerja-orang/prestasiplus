/**
 * Menu of the Portal Pentadbiran (D30, D107; `docs/prd/r1/30-admin-pusat.md` section 3) for Admin
 * Pusat only: the V2 groups and order, one `PentadbiranGroup` per V2 group (V2 section headings are
 * not rendered). `PENTADBIRAN_FULL_MENU` keeps the whole definition as data; `PENTADBIRAN_MENU`
 * (rendered) holds built screens only and drops empty groups (FR-ADM-H0.2). Unbuilt items are listed
 * in `docs/requirements/v2-pentadbiran-backlog.md`.
 *
 * Hidden or merged out of the definition (routes stay reachable by link or button): KS-02, KS-08,
 * KS-13, KS-14, KS-15, KS-16 (hidden); BS-01, BS-10 (Bank Lama retired 2026-11-09; PO: one bank, DSKP format); KS-09 (Set Builder);
 * KS-06 (hub lane card). Removed: KK-03, KS-10, KS-11, KS-12.
 *
 * This file is the composer (S0): group structure, order, icons and the id order inside each group.
 * The rows themselves (id, label, target route) live in `menu/fragments/s<n>.ts`, one file per sector
 * that owns the target route; a new row comes via a one-line cross-sector PR to S0 (plan section on
 * `menu.ts` ownership). The rendered menu also drops a repeated route or redirect target (`render.ts`).
 * `PENTADBIRAN_MENU` is the static render: it drops repeated routes only (no router here, so no cycle).
 * The layout builds the router-aware render, `renderMenu(PENTADBIRAN_FULL_MENU, redirectsFrom(router.getRoutes()))`,
 * which also drops an entry whose route is a router redirect to a page an earlier entry shows.
 */
import { renderMenu } from './menu/render'
import type { Row } from './menu/row'
import { S0_ROWS } from './menu/fragments/s0'
import { S2_ROWS } from './menu/fragments/s2'
import { S3_ROWS } from './menu/fragments/s3'
import { S4_ROWS } from './menu/fragments/s4'
import { S5_ROWS } from './menu/fragments/s5'
import { S6_ROWS } from './menu/fragments/s6'
import { S7_ROWS } from './menu/fragments/s7'

export interface PentadbiranItem {
  /** Doc id, for example `PM-04`. */
  id: string
  label: string
  /**
   * Optional second-level heading inside the group. Items that share a folded heading (Kirkpatrick)
   * are one sidebar row; items of a nested heading are indented rows under a
   * heading row (no group uses one today).
   */
  sub?: string
  /** `true` when `sub` is a visible sub-group heading (not a folded row). */
  nested?: boolean
  /** Small pill after the label, for example `LIVE`. */
  badge?: string
  to: string
  /** `false` = placeholder route. */
  built: boolean
}

export interface PentadbiranGroup {
  key: string
  /** Sidebar heading; omitted = no heading (the top shortcuts, 30 §3.1 row 0 names none). */
  label?: string
  /** Phosphor base name (listed in `src/theme/ds-icons.ts`). */
  icon: string
  items: readonly PentadbiranItem[]
}

/** Internal key of an item that is not built (never rendered, never routed). */
export const placeholderPath = (id: string): string => `/admin/p/${id.toLowerCase()}`

const NESTED_SUBS: ReadonlySet<string> = new Set<string>()
const BADGES: Readonly<Record<string, string>> = { 'PM-01': 'LIVE' }

function toItem([id, label, to, sub]: Row): PentadbiranItem {
  return {
    id,
    label,
    ...(sub ? { sub } : {}),
    ...(sub && NESTED_SUBS.has(sub) ? { nested: true } : {}),
    ...(BADGES[id] ? { badge: BADGES[id] } : {}),
    to: to ?? placeholderPath(id),
    built: to !== undefined,
  }
}

const ROWS_BY_ID: ReadonlyMap<string, Row> = (() => {
  const map = new Map<string, Row>()
  for (const rows of [S0_ROWS, S2_ROWS, S3_ROWS, S4_ROWS, S5_ROWS, S6_ROWS, S7_ROWS]) {
    for (const row of rows) {
      if (map.has(row[0])) throw new Error(`Pentadbiran menu: row ${row[0]} is defined in two fragments`)
      map.set(row[0], row)
    }
  }
  return map
})()

/** The group's items, in the order of the ids, from whichever fragment holds each row. */
function pick(...ids: string[]): PentadbiranItem[] {
  return ids.map((id) => {
    const row = ROWS_BY_ID.get(id)
    if (!row) throw new Error(`Pentadbiran menu: no fragment row for ${id}`)
    return toItem(row)
  })
}

export const PENTADBIRAN_FULL_MENU: readonly PentadbiranGroup[] = [
  {
    // V2 top shortcuts (30 §3.1 row 0).
    key: 'pintasan',
    icon: 'pulse',
    items: pick('PM-01', 'PM-02', 'BS-07'),
  },
  {
    // V2 section HARIAN. `/admin` is the Dashboard (S6-T11, R1-ADM-M-01).
    key: 'harian',
    label: 'Harian',
    icon: 'squares-four',
    items: pick('PP-01', 'PP-02'),
  },
  {
    // V2 section ANALITIK. The seven Kirkpatrick pages fold into one row (tabs inside the section).
    key: 'analitik',
    label: 'Analitik',
    icon: 'chart-line-up',
    items: pick('PM-04', 'PM-03', 'PM-05', 'PM-06', 'PM-07', 'PM-08', 'PM-09', 'PM-10', 'PM-11', 'PM-29'),
  },
  {
    key: 'kurikulum',
    label: 'Kurikulum',
    icon: 'book-open',
    items: pick('KK-01', 'KK-02', 'KK-04'),
  },
  {
    // 30 §3.2: nine definitions, all built (Sumber Kertas S2-T09, Kertas Subjektif S3-T06).
    key: 'soalan',
    label: 'Soalan',
    icon: 'books',
    items: pick('KS-01', 'BS-08', 'BS-02', 'KS-17', 'BS-03', 'KS-07', 'BS-09', 'BS-04', 'BS-05', 'BS-11'),
  },
  {
    key: 'pengguna',
    label: 'Pengguna',
    icon: 'users',
    items: pick('PS-01', 'PS-02', 'KW-05', 'PS-04', 'PS-06', 'PS-05', 'PS-03'),
  },
  {
    // The four lane pages open the admin lane page (FD-MENU-2); only the databank is built.
    key: 'spm',
    label: 'SPM',
    icon: 'scroll',
    items: pick('KS-18', 'KS-03', 'KS-04', 'KS-05'),
  },
  {
    key: 'premium',
    label: 'Premium',
    icon: 'star',
    items: pick('BS-06', 'KW-06'),
  },
  {
    key: 'kawalan-ciri',
    label: 'Sistem',
    icon: 'gear',
    items: pick('SY-02'),
  },
  {
    // Cabutan (PG-09) and Kotak Misteri are sections of Kawalan Reward, not menu rows.
    key: 'gamifikasi',
    label: 'Gamifikasi',
    icon: 'trophy',
    items: pick('PG-01', 'PG-02', 'PG-03', 'PG-04', 'PG-05', 'PG-06', 'PG-10'),
  },
  {
    key: 'battle-permainan',
    label: 'Battle & Permainan',
    icon: 'game-controller',
    items: pick('PG-12', 'PG-13', 'PG-11', 'PG-23'),
  },
  {
    key: 'marketplace',
    label: 'Marketplace',
    icon: 'gift',
    items: pick('PG-14', 'PG-15'),
  },
  {
    key: 'kandungan',
    label: 'Kandungan',
    icon: 'book-open-text',
    items: pick('KK-06', 'KK-05', 'KK-07', 'SY-05', 'KK-08'),
  },
  {
    key: 'sistem',
    label: 'Sistem',
    icon: 'gear',
    items: pick('SY-01', 'PG-22'),
  },
  {
    // Deferred or excluded (30 §3.1 last row, backlog): kept as data, never rendered.
    key: 'ditangguh',
    label: 'Ditangguhkan',
    icon: 'wallet',
    items: pick('PM-12', 'PM-13', 'PM-14', 'PM-15', 'PM-16', 'PM-17', 'PM-18', 'PM-19', 'PM-20', 'PM-21', 'PM-22', 'PM-23', 'PM-24', 'PM-25', 'PM-26', 'PM-27', 'PM-28', 'KK-09', 'KK-10', 'KK-11', 'KK-12', 'PG-07', 'PG-08', 'PG-16', 'PG-17', 'PG-18', 'PG-19', 'PG-20', 'PG-21', 'KW-01', 'KW-02', 'KW-03', 'KW-04', 'SY-03', 'SY-04'),
  },
]

/** All items, built or not (backlog data). */
export const FULL_ITEMS: readonly PentadbiranItem[] = PENTADBIRAN_FULL_MENU.flatMap((g) => g.items)

/**
 * The static rendered menu: built screens only, none whose route an earlier entry already shows; a group
 * left with no item is dropped. Redirect targets are deduped by the layout (see the file header).
 */
export const PENTADBIRAN_MENU: readonly PentadbiranGroup[] = renderMenu(PENTADBIRAN_FULL_MENU)

export const ALL_ITEMS: readonly PentadbiranItem[] = PENTADBIRAN_MENU.flatMap((g) => g.items)

/** Built item by doc id. */
export function itemById(id: string): PentadbiranItem | undefined {
  const upper = id.toUpperCase()
  return ALL_ITEMS.find((i) => i.id === upper)
}

export function groupOf(itemId: string): PentadbiranGroup | undefined {
  return PENTADBIRAN_MENU.find((g) => g.items.some((i) => i.id === itemId))
}

/** The active item: the longest `to` that equals the path or contains it at a `/` boundary. */
export function activeItem(path: string): PentadbiranItem | undefined {
  let best: PentadbiranItem | undefined
  for (const item of ALL_ITEMS) {
    const hit = path === item.to || path.startsWith(`${item.to}/`)
    if (hit && (!best || item.to.length > best.to.length)) best = item
  }
  return best
}

export const MENU_STORAGE_KEY = 'pentadbiran_menu'
