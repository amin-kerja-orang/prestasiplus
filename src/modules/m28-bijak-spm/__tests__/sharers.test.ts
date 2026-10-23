import { describe, expect, it } from 'vitest'

import { sharersText } from '../admin/papers/ui'
import { BANK } from '../data/registry'
import { BijakServer, MemoryStorage } from '../server/store'

const make = () => new BijakServer({ storage: new MemoryStorage() })

describe('shared stimulus: who shares it (FB-002)', () => {
  it('the edit page knows the real sharer count and labels', async () => {
    const e = await make().getBankEditable('mat1-g1-q2')
    expect(e.stimulus?.label).toBe('Rajah 1')
    expect(e.sharers).toMatchObject({ stimulusLabel: 'Rajah 1', count: 4 })
    expect(e.sharers!.questions.map((q) => q.position)).toEqual([1, 2, 3, 4])
    expect(e.sharers!.questions.filter((q) => q.current).map((q) => q.id)).toEqual(['mat1-g1-q2'])
  })

  it('a question without a stimulus has no sharers', async () => {
    expect((await make().getBankEditable('mat1-pub-1')).sharers).toBeUndefined()
  })

  it('a revision of one member of a 4-member group reports 4 sharers, not 1', async () => {
    const server = make()
    const e = await server.getBankEditable('mat1-g1-q1')
    const res = await server.reviseQuestionFull(
      'mat1-g1-q1',
      e.question,
      { ...e.stimulus!, alt: `${e.stimulus!.alt} (dilengkapkan)` },
      'Ubah teks alternatif',
    )
    expect(res).toEqual({ ok: true, errors: [] })
    const detail = await server.getReviewItem('v:mat1-g1-q1')
    expect(detail.questions).toHaveLength(1)
    expect(detail.sharers).toMatchObject({ stimulusLabel: 'Rajah 1', count: 4 })
    expect(detail.sharers!.questions.filter((q) => q.current).map((q) => q.id)).toEqual([
      'mat1-g1-q1',
    ])
  })

  it('a revision that leaves the stimulus alone shows no sharer notice', async () => {
    const server = make()
    const e = await server.getBankEditable('mat1-g1-q3')
    const res = await server.reviseQuestionFull(
      'mat1-g1-q3',
      { ...e.question, stem: `${e.question.stem} Ulang.` },
      e.stimulus,
      '',
    )
    expect(res.ok).toBe(true)
    expect((await server.getReviewItem('v:mat1-g1-q3')).sharers).toBeUndefined()
  })

  it('words the notice in Bahasa Melayu', () => {
    expect(
      sharersText({
        stimulusLabel: 'Rajah 1',
        count: 4,
        questions: [1, 2, 3, 4].map((n) => ({
          id: `q${n}`,
          position: n,
          ...(n === 2 ? { current: true } : {}),
        })),
      }),
    ).toBe(
      'Rajah 1 dikongsi oleh 4 soalan: Soalan 1, 2 (soalan ini), 3, 4. Perubahan di sini terpakai untuk semua soalan tersebut.',
    )
    expect(
      sharersText({
        stimulusLabel: 'Petikan 1',
        count: 1,
        questions: [{ id: 'q', position: 1, current: true }],
      }),
    ).toBe('Petikan 1 hanya digunakan oleh soalan ini.')
  })
})

describe('bank list: group size on every member (FB-003)', () => {
  it('every question of a stimulus group carries the group id and the real size', async () => {
    const rows = await make().listBank({ status: 'semua' })
    for (const g of BANK.groups.values()) {
      for (const id of g.questionIds) {
        const row = rows.find((r) => r.id === id)!
        expect(row.groupId, id).toBe(g.id)
        expect(row.groupSize, id).toBe(g.questionIds.length)
      }
    }
    expect(rows.filter((r) => r.groupId).every((r) => (r.groupSize ?? 0) >= 1)).toBe(true)
    expect(rows.filter((r) => !r.groupId).every((r) => r.groupSize === undefined)).toBe(true)
  })

  it('a group waiting for review shows its size too', async () => {
    const rows = await make().listBank({ status: 'semua' })
    const pending = rows.filter((r) => r.groupId === 'mat2-rev-g1')
    expect(pending.map((r) => r.groupSize)).toEqual([2, 2])
  })

  it('both members of mat2-segitiga show Kumpulan 2 soalan', async () => {
    const rows = await make().listBank({ status: 'semua' })
    for (const id of ['mat2-segitiga-v1-q1', 'mat2-segitiga-v1-q2', 'mat2-segitiga-v2-q1', 'mat2-segitiga-v2-q2'])
      expect(rows.find((r) => r.id === id)).toMatchObject({ groupSize: 2 })
  })

  it('the preview lists the siblings of a member', async () => {
    const d = await make().getBankDetail('mat1-g1-q2')
    expect(d.sharers!.questions.find((q) => q.current)?.id).toBe('mat1-g1-q2')
    expect(d.sharers!.questions.map((q) => q.id).filter((id) => id !== 'mat1-g1-q2')).toEqual([
      'mat1-g1-q1',
      'mat1-g1-q3',
      'mat1-g1-q4',
    ])
    expect((await make().getBankDetail('mat1-pub-1')).sharers).toBeUndefined()
  })
})

describe('group size is counted from the group members (FB-003 follow-up)', () => {
  it('a single-member group has size 1, so the bank chip is hidden', async () => {
    const rows = await make().listBank({ status: 'semua' })
    expect(rows.find((r) => r.id === 'sej2-q1')).toMatchObject({ groupId: 'sej2-bahan1', groupSize: 1 })
  })
})
