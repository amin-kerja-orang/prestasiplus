/**
 * Core schools seed (BE-05): a small fictitious set of schools across 2 states, plus the `jpns` and
 * `ppds` reference rows derived from the distinct state and district of ALL schools in the table
 * (plan 14.7 T-09, OD-28). Runs after the identity seed, which creates the two BE-03 demo schools
 * (DEMO001, DEMO002); this seed completes them (type, city, join code) and links every school.
 *
 * Rules: fictitious data only; idempotent (schools by `code`, jpns by `code`, ppds by `code`);
 * `legacy_*` is never set; existing rows loaded by the ETL are never changed except for the missing
 * jpn/ppd link of a school.
 */
import type { SeedModule } from '../index'

interface SchoolSeed {
  code: string
  name: string
  type: string
  state: string
  district: string
  city: string
  joinCode: string
}

/** JPN codes (mock `JPN_LIST`, data/geo.ts). The code of an unlisted state is its upper-case name. */
export const JPN_CODES: Readonly<Record<string, string>> = {
  Johor: 'JHR',
  Kedah: 'KDH',
  Kelantan: 'KTN',
  'Kuala Lumpur': 'WPKL',
  Labuan: 'WPL',
  Melaka: 'MLK',
  'Negeri Sembilan': 'NSN',
  Pahang: 'PHG',
  Perak: 'PRK',
  Perlis: 'PLS',
  'Pulau Pinang': 'PNG',
  Putrajaya: 'WPP',
  Sabah: 'SBH',
  Sarawak: 'SWK',
  Selangor: 'SGR',
  Terengganu: 'TRG',
}

/** The BE-03 demo schools get type, city and join code here (their name/state/district stay BE-03's). */
export const DEMO_SCHOOL_DETAILS: Readonly<Record<string, { type: string; city: string; joinCode: string }>> = {
  DEMO001: { type: 'SMK', city: 'Petaling Jaya', joinCode: 'DEMO0001' },
  DEMO002: { type: 'SK', city: 'Gombak', joinCode: 'DEMO0002' },
}

export const EXTRA_SCHOOLS: readonly SchoolSeed[] = [
  {
    code: 'DEMO003',
    name: 'SK Demo Tiga',
    type: 'SK',
    state: 'Johor',
    district: 'PPD JOHOR BAHRU',
    city: 'Johor Bahru',
    joinCode: 'DEMO0003',
  },
  {
    code: 'DEMO004',
    name: 'SJK(C) Demo Empat',
    type: 'SJK(C)',
    state: 'Johor',
    district: 'PPD JOHOR BAHRU',
    city: 'Johor Bahru',
    joinCode: 'DEMO0004',
  },
]

/** "PPD JOHOR BAHRU" -> "PPD Johor Bahru"; a value without the prefix is kept as is. */
export function ppdName(code: string): string {
  return code.replace(/^(PPD|PPW|JPN)\b(.*)$/, (_m, p: string, rest: string) => {
    const words = rest.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return [p, ...words.map((w) => w.charAt(0).toUpperCase() + w.slice(1))].join(' ')
  })
}

export const schoolsSeed: SeedModule = {
  name: 'core-schools',
  async run(ctx) {
    const { prisma } = ctx
    const createdAt = ctx.clock.now()

    for (const [code, d] of Object.entries(DEMO_SCHOOL_DETAILS)) {
      // Only fills a school that exists (the identity seed ran first) and has no value yet.
      const s = await prisma.school.findUnique({ where: { code } })
      if (!s) continue
      await prisma.school.update({
        where: { code },
        data: { type: s.type ?? d.type, city: s.city ?? d.city, joinCode: s.joinCode ?? d.joinCode },
      })
    }
    for (const s of EXTRA_SCHOOLS) {
      await prisma.school.upsert({
        where: { code: s.code },
        create: { ...s, isActive: true, createdAt },
        update: { name: s.name, type: s.type, state: s.state, district: s.district, city: s.city, joinCode: s.joinCode },
      })
    }

    // JPN per distinct state, PPD per distinct district (under the JPN of its state), then link schools.
    const schools = await prisma.school.findMany({ select: { id: true, state: true, district: true } })
    const jpnIds = new Map<string, bigint>()
    for (const state of new Set(schools.map((s) => s.state).filter((v): v is string => !!v))) {
      const code = JPN_CODES[state] ?? state.toUpperCase()
      const row = await prisma.jpn.upsert({
        where: { code },
        create: { code, name: state, createdAt },
        update: {},
      })
      jpnIds.set(state, row.id)
    }
    const ppdIds = new Map<string, bigint>()
    const seen = new Set<string>()
    for (const s of schools) {
      if (!s.state || !s.district || seen.has(s.district)) continue
      seen.add(s.district)
      const row = await prisma.ppd.upsert({
        where: { code: s.district },
        create: { code: s.district, name: ppdName(s.district), jpnId: jpnIds.get(s.state)!, createdAt },
        update: {},
      })
      ppdIds.set(s.district, row.id)
    }
    for (const s of schools) {
      const jpnId = s.state ? (jpnIds.get(s.state) ?? null) : null
      const ppdId = s.district ? (ppdIds.get(s.district) ?? null) : null
      await prisma.school.update({ where: { id: s.id }, data: { jpnId, ppdId } })
    }
  },
}
