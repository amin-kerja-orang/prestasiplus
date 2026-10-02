/**
 * F-30: the DSKP Bidang / SK / SP store against SRS M10 v1.15 §6.9 (XL2-20, M04 v1.13 SQ-7), and
 * the ids that M02, M04 and M08 reference (they must resolve).
 */

import { beforeAll, describe, expect, it } from 'vitest'

import { questions } from '@/modules/m04-question-bank/mock'

import { dskp } from '../../mock'
import { ADMIN_FILLER_SP_IDS, DSKP_PAIRS, dskpPairCount } from '../../mock/data/dskp'
import { bootM10 } from './helpers'

beforeAll(async () => {
  await bootM10()
}, 120_000)

describe('DSKP records (M10 §6.9)', () => {
  it('has one generic SP per subject–level pair: 187 pairs', () => {
    expect(dskpPairCount()).toBe(187)
    let generic = 0
    for (const [s, levels] of Object.entries(DSKP_PAIRS)) {
      for (const l of levels) {
        const id = dskp.genericSpId(Number(s), l)
        const path = dskp.spPath(id)
        expect(path, `pair ${s}/${String(l)} (SP ${String(id)})`).toBeDefined()
        expect(path?.bidang).toMatchObject({ subjectId: Number(s), educationLevelId: l })
        generic++
      }
    }
    expect(generic).toBe(187)
  })

  it('uses the id rule 8000 + 20 × subject + level; Sains T5 uses the observed SP 6191', () => {
    expect(dskp.genericSpId(1, 10)).toBe(8030)
    expect(dskp.genericSpId(3, 10)).toBe(8070)
    expect(dskp.genericSpId(14, 7)).toBe(8287)
    expect(dskp.genericSpId(14, 8)).toBe(8288)
    expect(dskp.genericSpId(14, 9)).toBe(8289)
    expect(dskp.genericSpId(27, 7)).toBe(8547)
    expect(dskp.genericSpId(4, 11)).toBe(6191)
    expect(dskp.getSp(6191)).toMatchObject({ code: 'T5SN.B9.1', skId: 2667 })
  })

  it('has a consistent Bidang → SK → SP chain', () => {
    const sizes = dskp.sizes()
    expect(sizes.bidang).toBeGreaterThan(190)
    for (const b of dskp.bidang()) {
      for (const k of dskp.sk(b.id)) {
        expect(k.bidangId).toBe(b.id)
        for (const p of dskp.sp(k.id)) {
          expect(dskp.spPath(p.id)?.bidang.id).toBe(b.id)
        }
      }
    }
    // every SP resolves to a full path
    let sp = 0
    for (const b of dskp.bidang()) for (const k of dskp.sk(b.id)) sp += dskp.sp(k.id).length
    expect(sp).toBe(sizes.sp)
  })

  it('seeds the Kimia T5 SPs 9001–9004 of class 2001 (M08 weak topics)', () => {
    const names = [9001, 9002, 9003, 9004].map((id) => dskp.getSp(id)?.description)
    expect(names).toEqual(['Sel Elektrolisis', 'Polimer', 'Siri Homolog', 'Getah Asli'])
    expect(dskp.getSp(9001)?.code).toBe('1.1.1')
    const path = dskp.spPath(9001)
    expect(path?.sk).toMatchObject({ id: 9011, code: '1.1', description: 'Kimia T5 — fixture SK' })
    expect(path?.bidang).toMatchObject({
      id: 9021,
      subjectId: 10,
      educationLevelId: 11,
      code: '1.0',
    })
    expect(dskp.getSp(8211)?.skId).toBe(9011)
  })

  it('seeds the observed Bahasa Melayu T4 SPs under the observed Bidang 2.0–5.0', () => {
    const bm = dskp.bidang({ subjectId: 1, educationLevelId: 10 })
    expect(bm.map((b) => b.code)).toEqual(['1.0', '2.0', '3.0', '4.0', '5.0'])
    expect(bm.map((b) => b.name)).toEqual([
      'Kemahiran Mendengar dan Bertutur',
      'Kemahiran Membaca',
      'Kemahiran Menulis',
      'Aspek Seni Bahasa',
      'Aspek Tatabahasa',
    ])
    const expected: Record<number, string> = {
      194: '2.0',
      206: '3.0',
      214: '4.0',
      221: '5.0',
      222: '5.0',
      179: '5.0',
    }
    for (const [sp, code] of Object.entries(expected)) {
      expect(dskp.spPath(Number(sp))?.bidang.code, `SP ${sp}`).toBe(code)
    }
    expect(dskp.getSp(221)?.code).toBe('5.1.2')
    expect(dskp.getSp(206)?.code).toBe('3.4.1')
    // 8 SK under 1.0, starting "1.1 — Mendengar, mengenal dan menyebut …"
    const sk10 = dskp.sk(bm[0]?.id as number)
    expect(sk10).toHaveLength(8)
    expect(sk10[0]).toMatchObject({
      code: '1.1',
      description: 'Mendengar, mengenal dan menyebut …',
    })
    // the pair's generic SP 8030 sits under SK "1.1" of Bidang 1.0; no fixture Bidang is added
    expect(dskp.spPath(8030)?.sk.code).toBe('1.1')
    expect(dskp.spPath(8030)?.bidang.code).toBe('1.0')
    expect(dskp.bidang({ subjectId: 1, educationLevelId: 11 }).map((b) => b.code)).toEqual([
      '1.0',
      '2.0',
      '3.0',
      '4.0',
      '5.0',
    ])
  })

  it('seeds Sejarah SP 418, the Sains T5 Bidang 515 / 57–65 and the Darjah 4 map tiles', () => {
    expect(dskp.getSp(418)).toMatchObject({
      code: '15.3.2',
      description: 'Menerangkan peranan Malaysia dalam hubungan ekonomi antarabangsa.',
    })
    expect(dskp.spPath(418)?.bidang).toMatchObject({ subjectId: 5, educationLevelId: 11 })
    const sains = dskp.bidang({ subjectId: 4, educationLevelId: 11 })
    expect(new Set(sains.map((b) => b.id))).toEqual(
      new Set([57, 58, 59, 60, 61, 62, 63, 64, 65, 515]),
    )
    expect(sains.find((b) => b.id === 515)).toMatchObject({
      name: 'Sains T5 - Sokongan Bab Buku Teks',
    })
    expect(sains.find((b) => b.id === 58)?.name).toBe('Nutrisi dan Teknologi Makanan')
    expect(
      dskp
        .sk(515)
        .map((k) => k.code)
        .sort(),
    ).toEqual(['BAB9', 'T5SN.B9'])
    expect(dskp.getSk(2667)?.description).toBe(
      'Menguasai konsep utama Bab 9: Satelit berdasarkan buku teks Sains Tingkatan 5.',
    )
    const tiles = dskp.sk(8024).map((k) => `${k.code} ${k.description}`)
    expect(tiles).toEqual([
      '1.1 Menguasai kandungan Kemahiran Membaca D4 bagi Darjah 4',
      '2.1 Menguasai kandungan Kemahiran Menulis D4 bagi Darjah 4',
      '3.1 Menguasai kandungan Aspek Tatabahasa D4 bagi Darjah 4',
    ])
    expect(dskp.sk(8104).map((k) => k.description)).toEqual([
      'Menguasai kandungan Kesultanan Melayu D4 bagi Darjah 4',
      'Menguasai kandungan Pengaruh Islam D4 bagi Darjah 4',
    ])
  })

  it('has the Matematik T4 Bidang with an empty code (name-only format)', () => {
    const b = dskp.getBidang(8070)
    expect(b).toMatchObject({
      code: null,
      subjectId: 3,
      educationLevelId: 10,
      name: 'Matematik T4 — fixture bidang',
    })
    expect(dskp.getSk(8070)?.code).toBe('1.1')
    expect(dskp.getSp(8070)?.code).toBe('1.1.1')
  })
})

describe('XR-M08-M10-01: SPs for the M08 admin S7 lists', () => {
  const spsOf = (subjectId: number, levels = [4, 10, 11]) =>
    dskp
      .bidang({ subjectId })
      .filter((b) => levels.includes(b.educationLevelId))
      .flatMap((b) => dskp.sk(b.id).flatMap((k) => dskp.sp(k.id)))
  it('holds exactly 26 distinct BM and 23 distinct SEJ SPs, all with a full path', () => {
    const bm = spsOf(1)
    const sej = spsOf(5, [4, 11])
    expect(new Set(bm.map((p) => p.id)).size).toBe(bm.length)
    expect(bm.length).toBe(26)
    expect(sej.length).toBe(23)
    for (const id of [...ADMIN_FILLER_SP_IDS.bm, ...ADMIN_FILLER_SP_IDS.sej]) {
      expect(dskp.spPath(id), 'SP ' + String(id)).toBeDefined()
    }
    expect(ADMIN_FILLER_SP_IDS.bm).toHaveLength(17)
    expect(ADMIN_FILLER_SP_IDS.sej).toHaveLength(20)
    // reserved block 9301–9499, no clash with named ids
    for (const id of [...ADMIN_FILLER_SP_IDS.bm, ...ADMIN_FILLER_SP_IDS.sej]) {
      expect(id >= 9401 && id <= 9499).toBe(true)
    }
  })
  it('the Darjah 4 map tiles are SPs coded 1.1 / 2.1 / 3.1 (BM) and 1.1 / 2.1 (SEJ) with the live titles', () => {
    const tiles = (subjectId: number) =>
      spsOf(subjectId, [4])
        .filter((p) => dskp.spPath(p.id)?.bidang.educationLevelId === 4)
        .map((p) => p.code + ' ' + p.description)
    expect(tiles(1)).toEqual([
      '1.1 Menguasai kandungan Kemahiran Membaca D4 bagi Darjah 4',
      '2.1 Menguasai kandungan Kemahiran Menulis D4 bagi Darjah 4',
      '3.1 Menguasai kandungan Aspek Tatabahasa D4 bagi Darjah 4',
    ])
    expect(tiles(5)).toEqual([
      '1.1 Menguasai kandungan Kesultanan Melayu D4 bagi Darjah 4',
      '2.1 Menguasai kandungan Pengaruh Islam D4 bagi Darjah 4',
    ])
    // generic SP ids stay (M04 dskpSpId) and the Sains T5 chain is untouched
    expect(dskp.hasSp(8024) && dskp.hasSp(8104)).toBe(true)
    expect(dskp.getSp(6191)).toMatchObject({ code: 'T5SN.B9.1', skId: 2667 })
  })
})

describe('ids referenced by M04 and M08 resolve', () => {
  it('every dskpSpId on an M04 question row exists in the M10 store', () => {
    const groups = questions.groupCount('Q-ALL', 'dskpSpId')
    let tagged = 0
    for (const [sp, n] of groups) {
      if (sp === null) continue
      tagged += n
      expect(dskp.hasSp(sp), `SP ${String(sp)} (${String(n)} rows)`).toBe(true)
    }
    expect(tagged).toBeGreaterThan(100_000)
  })

  it('the named SPs have their M04 available counts (Q-SP-AVAILABLE)', () => {
    const expected: Record<number, number> = {
      9001: 30,
      9002: 2,
      9003: 2,
      9004: 2,
      221: 16,
      206: 16,
      222: 7,
      214: 12,
      179: 13,
      194: 50,
      418: 13,
    }
    for (const [sp, n] of Object.entries(expected)) {
      expect(dskp.hasSp(Number(sp))).toBe(true)
      expect(questions.spAvailable(Number(sp)), `SP ${sp}`).toBe(n)
    }
  })
})

describe('teacher-created rows', () => {
  it('get ids from 9,000,001 upward with createdBy', () => {
    const b = dskp.createBidang(
      { subjectId: 10, educationLevelId: 11, code: '2.0', name: 'Ujian' },
      5,
    )
    const k = dskp.createSk({ bidangId: b.id, code: '2.1', description: 'SK ujian' }, 5)
    const p = dskp.createSp({ skId: k.id, code: '2.1.1', description: 'SP ujian' }, 5)
    expect([b.id, k.id, p.id]).toEqual([9_000_001, 9_000_001, 9_000_001])
    expect([b.createdBy, k.createdBy, p.createdBy]).toEqual([5, 5, 5])
    expect(dskp.spPath(p.id)?.bidang.name).toBe('Ujian')
    expect(dskp.bidang({ subjectId: 10, educationLevelId: 11 }).map((x) => x.code)).toEqual([
      '1.0',
      '2.0',
    ])
    expect(() => dskp.createSk({ bidangId: 123456789, code: 'x', description: 'x' }, 5)).toThrow()
  })
})
