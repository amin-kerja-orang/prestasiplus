/**
 * The rajah planner (T-B9-3), pure: the six worked examples of design 7.6 and the adversarial cases. Fictitious text only.
 */
import { describe, expect, it } from 'vitest'

import { isFigureCarrier, isPassageCarrier, planRajah, planFileLines, MAX_GROUP_MEMBERS, type RajahRow } from '../../../src/migration/load/questions/plan'
import type { LifecycleClass } from '../../../src/migration/transform/question-bank'

const four = ['Satu', 'Dua', 'Tiga', 'Empat']
const row = (id: number, stem: string, over: Partial<RajahRow> = {}): RajahRow => ({
  id: String(id), n: id, subject: '1', level: '4', cls: 'approved' as LifecycleClass, image: null, stem, optionTexts: four, loadable: true, createdMs: null, externalRef: null, ...over,
})
const carrier = (id: number, stem: string, image: string | null = 'a.png', over: Partial<RajahRow> = {}): RajahRow => row(id, stem, { optionTexts: [], loadable: false, image, ...over })
const plain = (id: number): RajahRow => row(id, `Soalan biasa ${id}.`)
const members = (p: ReturnType<typeof planRajah>) => p.groups.map((g) => `${g.confidence}:${g.cls}:${g.members.join(',')}`)

describe('carrier detection', () => {
  it('a caption is a carrier; a question with options or a cue is not', () => {
    expect(isFigureCarrier(carrier(1, 'Rajah 1'))).toBe(true)
    expect(isFigureCarrier(carrier(1, 'Gambar rajah 2. Kedudukan titik P dan Q'))).toBe(true)
    expect(isFigureCarrier(carrier(1, 'Rajah 1 menunjukkan graf. Hitung kelajuan.'))).toBe(false)
    expect(isFigureCarrier(carrier(1, 'Rajah 1?'))).toBe(false)
    expect(isFigureCarrier(row(1, 'Rajah 1'))).toBe(false)
    expect(isFigureCarrier(carrier(1, `Rajah 1 ${'x'.repeat(200)}`))).toBe(false)
    expect(isPassageCarrier(carrier(1, 'Teks berikut menerangkan kisah seorang murid yang gigih berusaha mengejar cita-citanya.', null))).toBe(true)
    expect(isPassageCarrier(carrier(1, 'Pendek sahaja.', null))).toBe(false)
  })
})

describe('the six worked examples (design 7.6)', () => {
  it('1: a carrier with an image and two followers is one High group, the carrier absorbed', () => {
    const p = planRajah({ rows: [carrier(5001, 'Rajah 1'), row(5002, 'Berdasarkan Rajah 1, hitung luas kawasan berlorek.'), row(5003, 'Berdasarkan Rajah 1, nyatakan jenis sudut.'), plain(5004)] })
    expect(members(p)).toEqual(['high:approved:5002,5003'])
    expect(p.absorbed.get('5001')).toBe('c:5001')
    expect(p.stimuli.get('c:5001')).toMatchObject({ kind: 'diagram', label: 'Rajah 1', imagePath: 'a.png' })
    expect(p.memberGroup.get('5003')).toBe('g:5002:approved')
    expect(p.summary.predictedFlaggedApproved).toBe(0)
  })

  it('2: the image owner stays member 1 and loses its own copy; the follower is position 2', () => {
    const p = planRajah({ rows: [row(6001, 'Rajah 2 menunjukkan graf jarak masa. Cari kelajuan.', { image: 'g.png' }), row(6002, 'Berdasarkan Rajah 2, hitung jarak.')] })
    expect(members(p)).toEqual(['high:approved:6001,6002'])
    expect(p.imageDropped.has('6001')).toBe(true)
    expect(p.stimuli.get('o:6001')).toMatchObject({ kind: 'diagram', imagePath: 'g.png' })
    expect(p.absorbed.size).toBe(0)
  })

  it('3: a passage carrier and two unnumbered followers: a passage stimulus, the carrier absorbed', () => {
    const passage = 'Teks berikut menerangkan kisah seorang murid yang gigih berusaha mengejar cita-citanya walaupun banyak dugaan.'
    const p = planRajah({ rows: [carrier(7001, passage, null), row(7002, 'Berdasarkan teks di atas, apakah tema cerita?'), row(7003, "Maksud 'gigih' dalam teks di atas ialah ..."), plain(7004)] })
    expect(members(p)).toEqual(['high:approved:7002,7003'])
    expect(p.stimuli.get('c:7001')).toMatchObject({ kind: 'passage', bodyText: passage })
  })

  it('3b: a passage carrier with one follower is only Medium: approved followers are held, the stimulus is kept unattached', () => {
    const passage = 'Teks berikut menerangkan kisah seorang murid yang gigih berusaha mengejar cita-citanya walaupun banyak dugaan.'
    const p = planRajah({ rows: [carrier(7001, passage, null), row(7002, 'Berdasarkan teks di atas, apakah tema cerita?')] })
    expect(p.groups).toHaveLength(0)
    expect(p.held).toMatchObject([{ cls: 'approved', stimulusKey: 'c:7001', members: ['7002'] }])
    expect(p.unattached).toEqual(['c:7001'])
    // the question names a source and shows none: the detector will flag it, so it is never served
    expect(p.unresolved.map((u) => u.id)).toEqual(['7002'])
  })

  it('4: a follower with no carrier and no image anywhere is unresolved (flagged, never served)', () => {
    const p = planRajah({ rows: [plain(7999), row(8001, 'Berdasarkan Rajah 3, tentukan nilai x.'), plain(8002)] })
    expect(p.groups).toHaveLength(0)
    expect(p.unresolved).toEqual([{ id: '8001', ref: 'numbered', cls: 'approved' }])
    expect(p.summary.predictedFlaggedApproved).toBe(1)
  })

  it('5: a carrier with no follower is an unattached stimulus, not a question', () => {
    const p = planRajah({ rows: [carrier(9001, 'Rajah 4'), plain(9002)] })
    expect(p.groups).toHaveLength(0)
    expect(p.absorbed.get('9001')).toBe('c:9001')
    expect(p.unattached).toEqual(['c:9001'])
    expect(p.stimuli.has('c:9001')).toBe(true)
  })

  it('6: one rajah shared by approved, archived and approved: one stimulus, an approved group and an archived group, the carrier absorbed once', () => {
    const p = planRajah({
      rows: [carrier(9100, 'Rajah 5'), row(9101, 'Berdasarkan Rajah 5, hitung perimeter.'), row(9102, 'Berdasarkan Rajah 5, hitung luas.', { cls: 'archived' }), row(9103, 'Berdasarkan Rajah 5, nyatakan bentuk.')],
    })
    expect(members(p)).toEqual(['high:approved:9101,9103', 'high:archived:9102'])
    expect(new Set(p.groups.map((g) => g.stimulusKey))).toEqual(new Set(['c:9100']))
    expect(p.absorbed.size).toBe(1)
    expect(p.groups.map((g) => g.key)).toEqual(['g:9101:approved', 'g:9102:archived'])
  })
})

describe('confidence tiers', () => {
  it('Medium (a gap of unrelated rows): approved is held, archived is grouped', () => {
    const p = planRajah({
      rows: [
        row(1, 'Rajah 6 menunjukkan segi tiga.', { image: 'a.png' }), plain(2), row(3, 'Berdasarkan Rajah 6, hitung tinggi.'),
        row(11, 'Rajah 7 menunjukkan bulatan.', { image: 'b.png', cls: 'archived' }), row(12, 'Soalan biasa 12.', { cls: 'archived' }), row(13, 'Berdasarkan Rajah 7, hitung jejari.', { cls: 'archived' }),
      ],
    })
    expect(members(p)).toEqual(['medium:archived:11,13'])
    expect(p.held).toMatchObject([{ cls: 'approved', stimulusKey: null, members: ['1', '3'] }])
    // the held follower keeps showing nothing: flagged. The owner keeps its own image.
    expect(p.unresolved.map((u) => u.id)).toEqual(['3'])
    expect(p.stimuli.has('o:1')).toBe(false)
  })

  it('a caption with no picture is only Medium (the image was never stored in V2)', () => {
    const p = planRajah({ rows: [carrier(1, 'Rajah 1', null), row(2, 'Berdasarkan Rajah 1, hitung x.'), row(3, 'Berdasarkan Rajah 1, hitung y.')] })
    expect(p.groups).toHaveLength(0)
    expect(p.held[0]?.members).toEqual(['2', '3'])
    expect(p.unresolved.map((u) => u.id)).toEqual(['2', '3'])
  })

  it('the same image on adjacent rows is a High group; far apart rows are never grouped', () => {
    const near = planRajah({ rows: [row(1, 'Soalan satu.', { image: 's.png' }), row(2, 'Soalan dua.', { image: 's.png' })] })
    expect(members(near)).toEqual(['high:approved:1,2'])
    expect(near.imageDropped.size).toBe(2)
    const far = planRajah({ rows: [row(1, 'Soalan satu.', { image: 's.png' }), ...Array.from({ length: 12 }, (_, i) => plain(10 + i)), row(30, 'Soalan dua.', { image: 's.png' })] })
    expect(far.groups).toHaveLength(0)
    const gapped = planRajah({ rows: [row(1, 'Soalan satu.', { image: 's.png' }), plain(2), plain(3), row(4, 'Soalan dua.', { image: 's.png' })] })
    expect(members(gapped)).toEqual(['medium:approved:1,4'].slice(0, 0)) // medium + approved: held, not grouped
    expect(gapped.held).toHaveLength(1)
  })

  it('an image owner alone in its class keeps a stem link to the shared stimulus', () => {
    const p = planRajah({ rows: [row(1, 'Rajah 2 menunjukkan graf.', { image: 'g.png' }), row(2, 'Berdasarkan Rajah 2, hitung a.', { cls: 'archived' })] })
    expect(members(p)).toEqual(['high:archived:2'])
    expect(p.ownerStimulus.get('1')).toBe('o:1')
    expect(p.stimuli.has('o:1')).toBe(true)
  })
})

describe('adversarial cases', () => {
  it('two carriers with the same key (two papers) never merge: each run stops at the next carrier', () => {
    const p = planRajah({ rows: [carrier(1, 'Rajah 1', 'a.png'), row(2, 'Berdasarkan Rajah 1, hitung x.'), carrier(3, 'Rajah 1', 'b.png'), row(4, 'Berdasarkan Rajah 1, hitung y.')] })
    expect(members(p)).toEqual(['high:approved:2', 'high:approved:4'])
    expect(p.groups.map((g) => g.stimulusKey)).toEqual(['c:1', 'c:3'])
  })

  it('a follower after an unrelated question is not attached (unresolved)', () => {
    const p = planRajah({ rows: [carrier(1, 'Rajah 8'), row(2, 'Berdasarkan Rajah 8, hitung a.'), plain(3), row(4, 'Berdasarkan Rajah 8, hitung b.')] })
    expect(members(p)).toEqual(['high:approved:2'])
    expect(p.unresolved.map((u) => u.id)).toEqual(['4'])
  })

  it('a run is cut at 40 members and the rest is left unresolved', () => {
    const rows = [carrier(1, 'Rajah 9'), ...Array.from({ length: 45 }, (_, i) => row(100 + i, `Berdasarkan Rajah 9, soalan ${i + 1}.`))]
    const p = planRajah({ rows })
    expect(p.groups).toHaveLength(1)
    expect(p.groups[0]?.members).toHaveLength(MAX_GROUP_MEMBERS)
    expect(p.unresolved).toHaveLength(5)
  })

  it('a different subject or level is a different partition', () => {
    const p = planRajah({ rows: [carrier(1, 'Rajah 1'), row(2, 'Berdasarkan Rajah 1, hitung x.', { subject: '2' })] })
    expect(p.groups).toHaveLength(0)
    expect(p.unresolved.map((u) => u.id)).toEqual(['2'])
  })

  it('a quarantined follower (not loadable) is left out of the group; with none loadable the carrier stays an unattached stimulus', () => {
    const p = planRajah({ rows: [carrier(1, 'Rajah 1'), row(2, 'Berdasarkan Rajah 1, hitung x.', { loadable: false })] })
    expect(p.groups).toHaveLength(0)
    expect(p.unattached).toEqual(['c:1'])
  })

  it('canonical stimulus shared by two exam questions is a High S1 group in canonical order', () => {
    const p = planRajah({
      rows: [row(10, 'Soalan sepuluh.'), row(11, 'Soalan sebelas.'), row(12, 'Soalan dua belas.')],
      canonicalStimuli: new Map([['s:9', { key: 's:9', kind: 'passage' as const, label: null, caption: null, bodyText: 'Petikan.', altText: null, imagePath: null }]]),
      canonicalLinks: [
        { stimulusKey: 's:9', legacyId: '12', position: 1, examQuestionCount: 3 },
        { stimulusKey: 's:9', legacyId: '10', position: 2, examQuestionCount: 3 },
      ],
    })
    expect(members(p)).toEqual(['high:approved:12,10'])
    expect(p.groups[0]?.signals).toEqual(['S1'])
    const single = planRajah({ rows: [row(10, 'a'), row(11, 'b')], canonicalStimuli: new Map(), canonicalLinks: [{ stimulusKey: 's:9', legacyId: '10', position: 1, examQuestionCount: 1 }] })
    expect(single.groups).toHaveLength(0)
  })

  it('is deterministic: the same rows in any order give the same plan hash; the plan file holds ids only', () => {
    const rows = [carrier(5001, 'Rajah 1'), row(5002, 'Berdasarkan Rajah 1, hitung luas.'), row(5003, 'Berdasarkan Rajah 1, nyatakan sudut.'), plain(5004)]
    const a = planRajah({ rows })
    const b = planRajah({ rows: [...rows].reverse() })
    expect(b.hash).toBe(a.hash)
    expect(planRajah({ rows: rows.slice(0, 2) }).hash).not.toBe(a.hash)
    const lines = planFileLines(a, { rules: 'x', inputHash: 'y' })
    expect(lines.join('\n')).not.toMatch(/Berdasarkan|hitung/)
    expect(JSON.parse(lines[0] as string)).toMatchObject({ t: 'meta', planHash: a.hash })
  })
})
