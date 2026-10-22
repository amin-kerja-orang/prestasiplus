import { PkskAdminAccessItemSchema, PkskAdminQuestionDetailSchema } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { ApiError } from '../../src/common/errors/api-error'
import { ADMIN_CALLER, buildWorld, grant, seedQuestions } from './fakes'

async function fail(p: Promise<unknown>) {
  try {
    await p
  } catch (e) {
    const err = e as ApiError
    return { status: err.getStatus(), code: err.code, fields: err.fields, message: err.message }
  }
  throw new Error('expected an error')
}

const mcq = (n = 3) => Array.from({ length: n }, (_, i) => ({ text: `Pilihan ${i}`, isCorrect: i === 0 }))
const valid = (over: Record<string, unknown> = {}) => ({
  bahagian: 'B',
  pkskDomainId: '2',
  pkskTargetLevel: 'T1',
  questionText: '  Berapa 1+1?  ',
  difficultyLevel: 2,
  options: mcq(),
  ...over,
})

describe('admin questions', () => {
  it('PKSK questions only: a non-PKSK id is 404 on get, update and delete, and 422 ids on bulk, and is never touched', async () => {
    const { adminQuestions, world } = buildWorld()
    const [plain] = seedQuestions(world, 'PKSK_MATH', 'T1', 1)
    if (plain) plain.pksk = false
    const id = plain?.id as string
    expect(await fail(adminQuestions.get(id))).toMatchObject({ status: 404, message: 'Soalan PKSK tidak dijumpai.' })
    expect(await fail(adminQuestions.update(ADMIN_CALLER, id, { ...valid(), status: 'approved' }))).toMatchObject({ status: 404 })
    expect(await fail(adminQuestions.remove(ADMIN_CALLER, id))).toMatchObject({ status: 404, message: 'Soalan PKSK tidak dijumpai.' })
    const real = seedQuestions(world, 'PKSK_MATH', 'T1', 1)[0]?.id as string
    for (const ids of [[id], [real, id], [real, '424242'], [real, 'abc']]) {
      expect(await fail(adminQuestions.bulk(ADMIN_CALLER, { action: 'delete', ids }))).toMatchObject({
        status: 422,
        fields: { ids: 'Sila pilih sekurang-kurangnya satu soalan PKSK.' },
      })
    }
    expect(world.questions.map((q) => q.id)).toContain(id)
    expect(world.questions).toHaveLength(2)
    expect(world.audits).toHaveLength(0)
    expect((await adminQuestions.list({})).data.map((r) => r.id)).toEqual([real])
    expect((await adminQuestions.stats()).total).toBe(1)
  })

  it('create: saved approved, sanitised, 201 data shape; Bahagian C ignores options', async () => {
    const { adminQuestions } = buildWorld()
    const res = await adminQuestions.create(ADMIN_CALLER, valid({ questionText: ' Teks\u0000 soalan ', explanation: '   ' }))
    expect(res.status).toBe('Soalan PKSK berjaya ditambah.')
    const d = PkskAdminQuestionDetailSchema.parse(res.data)
    expect(d).toMatchObject({ bahagian: 'B', pkskDomainId: '2', status: 'approved', questionText: 'Teks soalan', explanation: null })
    expect(d.options).toHaveLength(3)
    const c = await adminQuestions.create(ADMIN_CALLER, valid({ bahagian: 'C', pkskDomainId: '15' }))
    expect(c.data.options).toEqual([])
  })

  it('create: every field error is returned together with the mock messages', async () => {
    const { adminQuestions, world } = buildWorld()
    const r = await fail(adminQuestions.create(ADMIN_CALLER, { bahagian: 'Z', pkskDomainId: '999', pkskTargetLevel: 'T9', questionText: '  ', difficultyLevel: 9, options: [{ text: 'x', isCorrect: true }] }))
    expect(r).toMatchObject({ status: 422, code: 'VALIDATION_ERROR' })
    expect(r.fields).toEqual({
      bahagian: 'Sila pilih bahagian.',
      pkskDomainId: 'Sila pilih domain.',
      pkskTargetLevel: 'Sila pilih tingkatan.',
      questionText: 'Sila masukkan teks soalan.',
      difficultyLevel: 'Tahap kesukaran tidak sah.',
      options: 'Sila masukkan 2 hingga 6 pilihan jawapan.',
    })
    expect(r.message).toBe('Sila pilih bahagian. (and 5 more errors)')
    // a domain that does not belong to the chosen Bahagian
    expect((await fail(adminQuestions.create(ADMIN_CALLER, valid({ pkskDomainId: '15' })))).fields).toEqual({ pkskDomainId: 'Sila pilih domain.' })
    // empty option text
    expect((await fail(adminQuestions.create(ADMIN_CALLER, valid({ options: [{ text: 'a' }, { text: '  ' }] })))).fields).toEqual({ options: 'Sila masukkan teks pilihan jawapan.' })
    // unknown key (strict)
    expect((await fail(adminQuestions.create(ADMIN_CALLER, valid({ status: 'pending' })))).fields).toHaveProperty('status')
    expect(world.questions).toHaveLength(0)
  })

  it('update: status required, any transition, absent options keep stored ones, absent difficulty keeps stored value', async () => {
    const { adminQuestions, world } = buildWorld()
    const created = await adminQuestions.create(ADMIN_CALLER, valid({ difficultyLevel: 4 }))
    const id = created.data.id
    const body = { pkskDomainId: '2', pkskTargetLevel: 'T4', status: 'rejected', questionText: 'Baharu' }
    const res = await adminQuestions.update(ADMIN_CALLER, id, body)
    expect(res.status).toBe('Soalan PKSK berjaya dikemaskini.')
    expect(res.data).toMatchObject({ status: 'rejected', pkskTargetLevel: 'T4', difficultyLevel: 4 })
    expect(res.data.options).toHaveLength(3)
    expect((await adminQuestions.update(ADMIN_CALLER, id, { ...body, status: 'pending' })).data.status).toBe('pending')
    expect((await fail(adminQuestions.update(ADMIN_CALLER, id, { ...body, status: undefined }))).fields).toEqual({ status: 'Sila pilih status.' })
    expect(await fail(adminQuestions.update(ADMIN_CALLER, '424242', body))).toMatchObject({ status: 404 })
    // moving to an essay domain drops options; moving back without options has none stored
    const toC = await adminQuestions.update(ADMIN_CALLER, id, { ...body, pkskDomainId: '15' })
    expect(toC.data.options).toEqual([])
    expect((await fail(adminQuestions.update(ADMIN_CALLER, id, { ...body, pkskDomainId: '2' }))).fields).toEqual({ options: 'Sila masukkan 2 hingga 6 pilihan jawapan.' })
    expect(world.questions).toHaveLength(1)
  })

  it('list: case-insensitive AND filters, unknown values give an empty page, search, 20 per page', async () => {
    const { adminQuestions, world } = buildWorld()
    seedQuestions(world, 'PKSK_MATH', 'T1', 25)
    seedQuestions(world, 'PKSK_INSANIAH', 'T4', 2, 'pending')
    const all = await adminQuestions.list({})
    expect(all.data).toHaveLength(20)
    expect(all.meta).toMatchObject({ page: 1, pageSize: 20, totalItems: 27, totalPages: 2 })
    expect((await adminQuestions.list({ page: '2', pageSize: '500' })).data).toHaveLength(7)
    expect((await adminQuestions.list({ page: 'abc' })).meta.page).toBe(1)
    expect((await adminQuestions.list({ bahagian: 'a', level: 't4', status: 'PENDING' })).meta.totalItems).toBe(2)
    for (const q of [{ bahagian: 'Z' }, { level: 'T9' }, { status: 'zzz' }]) expect((await adminQuestions.list(q)).data).toEqual([])
    expect((await adminQuestions.list({ search: ' SOALAN 1000 ' })).meta.totalItems).toBe(1)
    const item = (await adminQuestions.list({ bahagian: 'A' })).data[0]
    expect(item).toMatchObject({ bahagian: 'A', targetLevel: 'T4', status: 'pending', domain: { code: 'PKSK_INSANIAH' } })
    expect(await adminQuestions.stats()).toEqual({ total: 27, approved: 25, pending: 2, t1: 25, t4: 2 })
  })

  it('bulk: approve, reject, delete with counts, duplicates count once, invalid action', async () => {
    const { adminQuestions, world } = buildWorld()
    const ids = seedQuestions(world, 'PKSK_MATH', 'T1', 3, 'pending').map((q) => q.id)
    expect(await adminQuestions.bulk(ADMIN_CALLER, { action: 'approve', ids: [ids[0], ids[0], ids[1]] })).toEqual({ data: { affected: 2 }, status: '2 soalan telah diluluskan.' })
    expect((await adminQuestions.bulk(ADMIN_CALLER, { action: 'reject', ids: [ids[2]] })).status).toBe('1 soalan telah ditolak.')
    expect(world.questions.map((q) => q.status)).toEqual(['approved', 'approved', 'rejected'])
    expect(await fail(adminQuestions.bulk(ADMIN_CALLER, { action: 'nuke', ids }))).toMatchObject({ status: 422, fields: { action: 'Tindakan tidak sah.' } })
    expect((await fail(adminQuestions.bulk(ADMIN_CALLER, { action: 'delete', ids: [] }))).fields).toEqual({ ids: 'Sila pilih sekurang-kurangnya satu soalan PKSK.' })
    const del = await adminQuestions.bulk(ADMIN_CALLER, { action: 'delete', ids })
    expect(del).toEqual({ data: { affected: 3 }, status: '3 soalan telah dipadam.' })
    expect(world.questions).toHaveLength(0)
    // the audit row carries ids only
    expect(world.audits).toHaveLength(1)
    expect(world.audits[0]).toMatchObject({ action: 'pksk.questions.deleted', actorUserId: '99', details: { ids, count: 3 } })
    expect(JSON.stringify(world.audits[0])).not.toContain('Soalan')
  })
})

describe('admin access', () => {
  it('grant: 201 item, granted by the admin, past dates accepted, student sees it at once', async () => {
    const { adminAccess, student, world } = buildWorld()
    const res = await adminAccess.grant(ADMIN_CALLER, { userId: '10', packageId: '3', expiresAt: null })
    expect(res.status).toBe('Akses PKSK berjaya diberi.')
    const item = PkskAdminAccessItemSchema.parse(res.data)
    expect(item).toMatchObject({ user: { id: '10', name: 'Pelajar Satu' }, package: { level: 'ALL' }, grantedBy: { id: '99', name: 'Admin Demo' }, status: 'active', displayStatus: 'active', expiresAt: null })
    expect(await student.access({ userId: '10', role: 'student', isTest: false } as never)).toEqual({ T1: true, T4: true })
    const past = await adminAccess.grant(ADMIN_CALLER, { userId: '10', packageId: '1', expiresAt: '2020-01-01' })
    expect(past.data.displayStatus).toBe('expired')
    expect(world.grants).toHaveLength(2)
    expect(world.audits.map((a) => a.action)).toEqual(['pksk.access.granted', 'pksk.access.granted'])
    expect(world.audits[0]).toMatchObject({ targetId: '1', details: { userId: '10', packageId: '3' } })
    expect(JSON.stringify(world.audits)).not.toMatch(/satu@demo|Pelajar/)
  })

  it('grant: all field errors together, nothing written', async () => {
    const { adminAccess, world } = buildWorld()
    const r = await fail(adminAccess.grant(ADMIN_CALLER, { userId: '12345', packageId: '77', expiresAt: '2026-02-30' }))
    expect(r.status).toBe(422)
    expect(r.fields).toEqual({ userId: 'Pengguna tidak dijumpai.', packageId: 'Sila pilih pakej.', expiresAt: 'Tarikh tamat tidak sah.' })
    expect((await fail(adminAccess.grant(ADMIN_CALLER, { userId: 'x', packageId: '' }))).fields).toEqual({ userId: 'Pengguna tidak dijumpai.', packageId: 'Sila pilih pakej.' })
    expect((await fail(adminAccess.grant(ADMIN_CALLER, {}))).fields).toMatchObject({ userId: 'Pengguna tidak dijumpai.', packageId: 'Sila pilih pakej.' })
    expect(world.grants).toHaveLength(0)
    // a blank expiry is read as none
    expect((await adminAccess.grant(ADMIN_CALLER, { userId: '10', packageId: '1', expiresAt: '' })).data.expiresAt).toBeNull()
  })

  it('revoke: 404 unknown, 409 revoked or expired, 200 otherwise and the row stays listed', async () => {
    const { adminAccess, student, world } = buildWorld()
    const live = grant(world, '10', 'T1')
    const dead = grant(world, '10', 'T4', { expiresAt: '2020-01-01' })
    const gone = grant(world, '11', 'T4', { status: 'revoked' })
    expect(await fail(adminAccess.revoke(ADMIN_CALLER, '4242'))).toMatchObject({ status: 404, message: 'Rekod akses tidak dijumpai.' })
    for (const g of [dead, gone]) expect(await fail(adminAccess.revoke(ADMIN_CALLER, g.id))).toMatchObject({ status: 409, code: 'CONFLICT', message: 'Akses ini tidak aktif dan tidak boleh ditarik balik.' })
    const res = await adminAccess.revoke(ADMIN_CALLER, live.id)
    expect(res.status).toBe('Akses PKSK telah ditarik balik.')
    expect(res.data).toMatchObject({ status: 'revoked', displayStatus: 'revoked' })
    expect(await student.access({ userId: '10', role: 'student', isTest: false } as never)).toEqual({ T1: false, T4: false })
    expect((await adminAccess.list({})).data).toHaveLength(3)
    expect(world.audits.map((a) => a.action)).toEqual(['pksk.access.revoked'])
    // a second revoke is 409
    expect(await fail(adminAccess.revoke(ADMIN_CALLER, live.id))).toMatchObject({ status: 409 })
  })

  it('list: newest first, search by name or e-mail, null e-mail kept, stats count live rows only with Kombo in both', async () => {
    const { adminAccess, world } = buildWorld()
    grant(world, '10', 'ALL')
    grant(world, '11', 'T1')
    grant(world, '11', 'T4', { expiresAt: '2020-01-01' })
    grant(world, '10', 'T4', { status: 'revoked' })
    const list = await adminAccess.list({})
    expect(list.meta.totalItems).toBe(4)
    expect(list.data[0]?.id).toBe('1')
    expect((await adminAccess.list({ search: ' SATU@DEMO ' })).data.every((r) => r.user.id === '10')).toBe(true)
    expect((await adminAccess.list({ search: 'dua' })).data[0]?.user.email).toBeNull()
    expect(await adminAccess.stats()).toEqual({ activeTotal: 2, t1: 2, t4: 1 })
    expect((await adminAccess.packages()).map((p) => p.level)).toEqual(['T1', 'T4', 'ALL'])
  })
})
