import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { ROLE_CODES } from '../../common/enums'
import { buildOpenApiDocument } from '../../openapi'
import {
  ACCESS_GROUPS,
  ACCESS_MATRIX,
  LEARNING_MENU,
  PROTOTYPE_ITEMS,
  SCHOOL_ADMIN_PROTOTYPE_ROWS,
  LearningMenuGroupSchema,
  MatrixItemSchema,
  AccessGroupSchema,
  capabilitiesFor,
  visibleGroups,
  visibleItems,
} from '../index'

const EXPECTED_COUNTS: Record<string, number> = {
  'papan-pemuka': 2,
  pemantauan: 28,
  'bank-soalan': 7,
  'kertas-spm': 12,
  'kurikulum-kandungan': 12,
  'pengguna-sekolah': 6,
  penglibatan: 22,
  kewangan: 6,
  sistem: 5,
}

const ids = (role: (typeof ROLE_CODES)[number], scope?: { level: 'state' | 'district' }) =>
  visibleItems(role, { scope }).map((i) => i.id)
const groupIds = (role: (typeof ROLE_CODES)[number]) => visibleGroups(role).map((g) => g.id)

describe('access matrix structure', () => {
  it('has exactly 100 items in 9 groups', () => {
    expect(ACCESS_MATRIX).toHaveLength(100)
    expect(ACCESS_GROUPS).toHaveLength(9)
  })

  it('has the per-group counts of v2-portals 6.12', () => {
    for (const group of ACCESS_GROUPS) {
      expect(ACCESS_MATRIX.filter((i) => i.group === group.id)).toHaveLength(
        EXPECTED_COUNTS[group.id] as number,
      )
    }
  })

  it('keeps group order, labels and item order', () => {
    expect(ACCESS_GROUPS.map((g) => g.labelBm)).toEqual([
      'Papan Pemuka',
      'Pemantauan',
      'Bank Soalan',
      'Kertas & SPM',
      'Kurikulum & Kandungan',
      'Pengguna & Sekolah',
      'Penglibatan',
      'Kewangan',
      'Sistem',
    ])
    expect(ACCESS_GROUPS.map((g) => g.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    const rank = new Map(ACCESS_GROUPS.map((g, i) => [g.id, i]))
    const groupRanks = ACCESS_MATRIX.map((i) => rank.get(i.group) as number)
    expect(groupRanks).toEqual([...groupRanks].sort((a, b) => a - b))
  })

  it('validates every item and group with its schema', () => {
    for (const item of ACCESS_MATRIX) expect(MatrixItemSchema.safeParse(item).success).toBe(true)
    for (const group of ACCESS_GROUPS) expect(AccessGroupSchema.safeParse(group).success).toBe(true)
    for (const g of LEARNING_MENU) expect(LearningMenuGroupSchema.safeParse(g).success).toBe(true)
  })

  it('has unique ids, routes and capability keys', () => {
    expect(new Set(ACCESS_MATRIX.map((i) => i.id)).size).toBe(100)
    expect(new Set(ACCESS_MATRIX.map((i) => i.route)).size).toBe(100)
    expect(new Set(ACCESS_MATRIX.map((i) => i.capability)).size).toBe(100)
    const all = ROLE_CODES.flatMap((r) => capabilitiesFor(r).map((c) => `${r}:${c.key}`))
    expect(new Set(all).size).toBe(all.length)
    for (const role of ROLE_CODES) {
      const keys = capabilitiesFor(role).map((c) => c.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it('matches ids, order and labels of the requirements document tables', () => {
    const md = readFileSync(
      fileURLToPath(new URL('../../../../../docs/requirements/v2-portals.md', import.meta.url)),
      'utf8',
    )
    const section = md.slice(md.indexOf('## 6. Complete Portal'), md.indexOf('### 6.10'))
    const rows = [...section.matchAll(/^\| ([A-Z]{2}-\d{2}) \| ([^|]+?) \|/gm)].map((m) => ({
      id: m[1] as string,
      label: (m[2] as string).replace(/\*\*/g, '').replace(/\s*\(was .*\)$/, ''),
    }))
    expect(rows.map((r) => r.id)).toEqual(ACCESS_MATRIX.map((i) => i.id))
    for (const [n, row] of rows.entries()) {
      const label = (ACCESS_MATRIX[n] as { labelBm: string }).labelBm
      // Doc labels may carry an English gloss in parentheses that the UI copy omits.
      expect(row.label.startsWith(label), `${row.id}: ${row.label} vs ${label}`).toBe(true)
    }
  })
})

describe('per-role visibility (D30, US-03, US-11 to US-13)', () => {
  it('admin sees all nine groups and all 100 items', () => {
    expect(groupIds('admin')).toHaveLength(9)
    expect(ids('admin')).toHaveLength(100)
  })

  it('ppd_officer sees only Pemantauan and Pengguna & Sekolah, read-only', () => {
    expect(groupIds('ppd_officer')).toEqual(['pemantauan', 'pengguna-sekolah'])
    const items = visibleItems('ppd_officer')
    expect(items).toHaveLength(12)
    for (const item of items) expect(['R', 'D']).toContain(item.modes.ppd_officer)
    expect(capabilitiesFor('ppd_officer').every((c) => c.kind === 'read')).toBe(true)
    expect(ids('ppd_officer')).toContain('PM-14')
    expect(ids('ppd_officer')).not.toContain('PP-01')
  })

  it('hides PPD-only items from a JPN (state) officer', () => {
    const state = ids('ppd_officer', { level: 'state' })
    const district = ids('ppd_officer', { level: 'district' })
    expect(district).toHaveLength(12)
    expect(state).toEqual(district.filter((id) => !['PM-01', 'PM-17', 'PM-18', 'PM-19', 'PM-20'].includes(id)))
  })

  it('school_admin sees Papan Pemuka, Pemantauan, Kurikulum & Kandungan (Video only), Pengguna & Sekolah, Kewangan', () => {
    expect(groupIds('school_admin')).toEqual(['papan-pemuka', 'pemantauan', 'kurikulum-kandungan', 'pengguna-sekolah', 'kewangan'])
    expect(visibleItems('school_admin').filter((i) => i.group === 'kurikulum-kandungan').map((i) => i.id)).toEqual(['KK-12'])
    expect(visibleItems('school_admin')).toHaveLength(2 + 22 + 1 + 5 + 6)
    for (const item of visibleItems('school_admin')) expect(item.modes.school_admin).toBe(item.id === 'KK-12' ? 'R' : 'S')
  })

  it('learner roles see no Pentadbiran item or capability', () => {
    for (const role of ['teacher', 'student', 'parent', 'sponsor'] as const) {
      expect(visibleItems(role)).toEqual([])
      expect(visibleGroups(role)).toEqual([])
      expect(capabilitiesFor(role)).toEqual([])
    }
  })

  it('never lists an item for a role whose mode is hidden', () => {
    for (const role of ['admin', 'ppd_officer', 'school_admin'] as const) {
      const visible = new Set(ids(role))
      for (const item of ACCESS_MATRIX) {
        expect(visible.has(item.id)).toBe(item.modes[role] !== undefined)
      }
    }
  })

  it('keeps Bank Soalan and the whole Pusat-only groups closed to ppd and school admins (D30, D40a)', () => {
    for (const group of ['bank-soalan', 'kertas-spm', 'kurikulum-kandungan', 'penglibatan', 'sistem']) {
      for (const item of ACCESS_MATRIX.filter((i) => i.group === group && i.id !== 'KK-12')) {
        expect(item.modes.ppd_officer).toBeUndefined()
        expect(item.modes.school_admin).toBeUndefined()
      }
    }
  })

  it('gives write capabilities only to F and S modes', () => {
    const caps = capabilitiesFor('admin')
    expect(caps.filter((c) => c.kind === 'read')).toHaveLength(100)
    // PG-12 and PG-13 are read-only for Pusat.
    expect(caps.filter((c) => c.kind === 'write')).toHaveLength(98)
    expect(capabilitiesFor('school_admin').filter((c) => c.kind === 'write')).toHaveLength(35)
  })
})

describe('v2 prototype scope (D43, role-access-matrix.md)', () => {
  const md = readFileSync(
    fileURLToPath(new URL('../../../../../docs/requirements/role-access-matrix.md', import.meta.url)),
    'utf8',
  )
  const rows = [...md.matchAll(/^\| (\d+) \|[^|]*\|([^|]*)\|\s*(✓|—)\s*\|\s*(✓|—)\s*\|\s*(✓|—)\s*\|$/gm)].map(
    (m) => ({ row: Number(m[1]), label: (m[2] as string).trim(), murid: m[3], guru: m[4], sekolah: m[5] }),
  )

  it('parses the 53 rows with 37 / 15 / 18 ticks', () => {
    expect(rows).toHaveLength(53)
    expect(rows.filter((r) => r.murid === '✓')).toHaveLength(37)
    expect(rows.filter((r) => r.guru === '✓')).toHaveLength(15)
    expect(rows.filter((r) => r.sekolah === '✓')).toHaveLength(18)
  })

  it('has 37 Murid and 15 Guru module items plus 5 account items per role', () => {
    const modules = (role: string) => PROTOTYPE_ITEMS.filter((i) => i.role === role && i.row > 0)
    const account = (role: string) => PROTOTYPE_ITEMS.filter((i) => i.role === role && i.row === 0)
    expect(modules('student').map((i) => i.row)).toEqual(rows.filter((r) => r.murid === '✓').map((r) => r.row))
    expect(modules('teacher').map((i) => i.row)).toEqual(rows.filter((r) => r.guru === '✓').map((r) => r.row))
    for (const role of ['student', 'teacher', 'school_admin']) expect(account(role)).toHaveLength(5)
    expect(PROTOTYPE_ITEMS.every((i) => i.inV2Prototype)).toBe(true)
  })

  it('maps Admin Sekolah rows; unmappable rows are explicit (null)', () => {
    expect(SCHOOL_ADMIN_PROTOTYPE_ROWS.map((r) => r.row)).toEqual(
      rows.filter((r) => r.sekolah === '✓').map((r) => r.row),
    )
    expect(SCHOOL_ADMIN_PROTOTYPE_ROWS.filter((r) => r.itemIds === null)).toEqual([])
    expect(SCHOOL_ADMIN_PROTOTYPE_ROWS).toHaveLength(18)
    const proto = visibleItems('school_admin', { prototypeOnly: true })
    expect(proto.map((i) => i.id)).toEqual([
      'PP-01', 'PM-01', 'PM-03', 'PM-05', 'PM-06', 'PM-07', 'PM-08', 'PM-09', 'PM-10', 'PM-11',
      'PM-12', 'PM-15', 'PM-21', 'PM-22', 'PM-23', 'PM-24', 'PM-25', 'PM-26', 'PM-27', 'PM-28',
      'KK-12', 'PS-01', 'PS-03',
    ])
    expect(proto.every((i) => i.prototypeScope)).toBe(true)
  })

  it('flags only school_admin-mapped items and yields nothing for admin and ppd_officer', () => {
    expect(ACCESS_MATRIX.filter((i) => i.prototypeScope)).toHaveLength(23)
    expect(visibleItems('admin', { prototypeOnly: true })).toEqual([])
    expect(visibleItems('ppd_officer', { prototypeOnly: true })).toEqual([])
    expect(visibleGroups('school_admin', { prototypeOnly: true }).map((g) => g.id)).toEqual([
      'papan-pemuka',
      'pemantauan',
      'kurikulum-kandungan',
      'pengguna-sekolah',
    ])
  })
})

describe('Pembelajaran menus (section 8, US-14)', () => {
  it('has the group order per role', () => {
    const labels = (role: string) => LEARNING_MENU.filter((g) => g.role === role).map((g) => g.labelBm)
    expect(labels('student')).toEqual([
      null,
      'SPM',
      'Pembelajaran',
      'Pusat AI',
      '🏆 Bilik Duta',
      '✨ Visi & Pertandingan',
      '💎 Killer Features',
      'Akaun & Bantuan',
    ])
    expect(labels('teacher')).toEqual([
      'Command Center (LIVE)',
      'HARIAN',
      'PENGAJARAN',
      'PENILAIAN',
      'ANALITIK',
      'PUSAT AI',
      'BANK SOALAN',
      'AKTIVITI',
      'LAIN-LAIN',
      'Bantuan',
    ])
    expect(labels('parent')).toHaveLength(3)
    expect(labels('sponsor')).toHaveLength(2)
  })

  it('links nothing into Portal Pentadbiran', () => {
    for (const g of LEARNING_MENU) expect(JSON.stringify(g)).not.toContain('/admin')
  })
})

describe('openapi components', () => {
  it('publishes the access schemas', () => {
    const schemas = (buildOpenApiDocument() as { components: { schemas: Record<string, unknown> } }).components
      .schemas
    for (const name of ['AccessMatrixItem', 'AccessGroup', 'AccessRoleModes', 'AccessCapability', 'LearningMenuGroup']) {
      expect(schemas[name]).toBeDefined()
    }
  })
})
