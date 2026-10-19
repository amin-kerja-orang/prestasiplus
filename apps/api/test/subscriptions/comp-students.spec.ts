import {
  CompStudentDetailSchema,
  CompStudentListItemSchema,
  ErrorBodySchema,
  StudentImportResultSchema,
  COMP_STUDENT_MESSAGES,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { compLineError, parseCompLines } from '../../src/modules/subscriptions/comp-students/comp-lines'
import type { CompClassroom, CompClassroomPort, CompEnrolmentView } from '../../src/modules/subscriptions/comp-students/classroom.port'
import { ADMIN, STUDENT, apiOf, bootSubApp, expectError, fieldsOf, login, schoolIdOf, userIdOf, type Api, type SubTestApp } from './sub-helpers'

/** A fake classroom owner (BE-17 is not built): classroom "500" belongs to the given school. */
class FakeClassrooms implements CompClassroomPort {
  school: CompClassroom = { id: '500', schoolId: null, schoolName: 'SMK Demo Satu', grade: 10 }
  readonly enrolled = new Map<string, string[]>()

  find(id: string): Promise<CompClassroom | null> {
    return Promise.resolve(id === this.school.id ? this.school : null)
  }

  enrol(classroomId: string, studentIds: readonly string[]): Promise<void> {
    this.enrolled.set(classroomId, [...(this.enrolled.get(classroomId) ?? []), ...studentIds])
    return Promise.resolve()
  }

  describe(ids: readonly string[]): Promise<Map<string, CompEnrolmentView>> {
    const out = new Map<string, CompEnrolmentView>()
    for (const id of ids) {
      if ((this.enrolled.get('500') ?? []).includes(id)) {
        out.set(id, {
          classLabel: '4 Amanah',
          teacherName: 'Guru Demo',
          classes: [{ name: '4 Amanah', classCode: 'ABC123', subjectName: 'Sejarah', teacherName: 'Guru Demo', status: 'active' }],
        })
      }
    }
    return Promise.resolve(out)
  }
}

describe('complimentary lines (pure, mock BR-18)', () => {
  it('the IC follows the LAST comma, non-digits stripped; line numbers count blank lines', () => {
    const lines = parseCompLines('Tan, Ah Kow, 070101-01-0101\n\n  \r\nSiti\n,123456\nAli,12345')
    expect(lines).toEqual([
      { line: 1, name: 'Tan, Ah Kow', ic: '070101010101', comma: true },
      { line: 4, name: 'Siti', ic: '', comma: false },
      { line: 5, name: '', ic: '123456', comma: true },
      { line: 6, name: 'Ali', ic: '12345', comma: true },
    ])
    expect(lines.map(compLineError)).toEqual([null, COMP_STUDENT_MESSAGES.badLine, COMP_STUDENT_MESSAGES.badLine, COMP_STUDENT_MESSAGES.shortIc])
    expect(COMP_STUDENT_MESSAGES.badLine).toBe('Format baris tidak sah. Gunakan NAMA, NOKP.')
    expect(COMP_STUDENT_MESSAGES.shortIc).toBe('No. KP mesti sekurang-kurangnya 6 digit.')
    expect(compLineError({ line: 1, name: 'Ali', ic: '123456', comma: true })).toBeNull()
  })
})

describe('complimentary students (AC 3)', () => {
  let t: SubTestApp
  let admin: Api
  let s1: string
  const port = new FakeClassrooms()

  beforeAll(async () => {
    t = await bootSubApp({ classrooms: port })
    admin = apiOf(await login(t, ADMIN))
    s1 = await schoolIdOf(t.db, 'DEMO001')
    port.school = { ...port.school, schoolId: s1 }
  })
  afterAll(async () => {
    await t.close()
  })

  const register = (over: Record<string, unknown> = {}) =>
    admin.post('/admin/comp-students', { classroomId: '500', packageExpiresAt: '2026-12-31', students: 'Aina Contoh, 070101-01-0101', ...over })
  const compUser = async (name: string) =>
    (await t.db.query<{ id: string }>(`select u.id::text from users u join comp_students c on c.user_id = u.id where u.name = $1`, [name]))[0]?.id as string
  const audits = (action: string) =>
    t.db.query<{ actor_user_id: string; actor_role: string; target_id: string; detail: Record<string, unknown> }>(
      `select actor_user_id::text, actor_role, target_id, detail from audit_events where action = $1 order by id`,
      [action],
    )

  describe('POST /admin/comp-students', () => {
    it('registers each line: generated login not derived from the IC, hashed and masked IC, must change password, coins off, enrolled', async () => {
      const res = await register({ students: 'Aina Contoh, 070101-01-0101\nBudi Contoh,880202025555\n' })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      expect(res.body.status).toBe('2 pelajar komplimen berjaya didaftarkan.')
      expect(StudentImportResultSchema.parse(res.body.data)).toEqual({ created: 2, skipped: 0, failed: 0, errors: [] })
      const users = await t.db.query<{
        name: string
        email: string
        ic_hash: string
        ic_masked: string
        school_id: string
        grade: number
        must: boolean
        comp: boolean
        hash: string
        coins: boolean
        expires: string
        orig: string
        role: string
      }>(
        `select u.name, u.email, u.ic_hash, u.ic_masked, u.school_id::text, u.grade, u.must_reset_password must, u.is_complimentary comp, u.password_hash hash,
                c.coins_enabled coins, c.package_expires_on::text expires, c.original_school_name orig, r.role
           from users u join comp_students c on c.user_id = u.id join user_roles r on r.user_id = u.id where u.name like '% Contoh' order by u.id`,
      )
      expect(users).toHaveLength(2)
      const aina = users[0]
      expect(aina).toMatchObject({ name: 'Aina Contoh', ic_masked: 'xxxxxx-xx-xx01', school_id: s1, grade: 10, must: true, comp: true, coins: false, expires: '2026-12-31', orig: 'SMK Demo Satu', role: 'student' })
      expect(aina?.email).toMatch(/^komp-[0-9a-f]{18}@prestasiplus\.my$/)
      expect(aina?.email).not.toContain('010101')
      expect(aina?.ic_hash).toMatch(/^[0-9a-f]{64}$/)
      expect(aina?.hash.startsWith('$argon2id$')).toBe(true)
      expect(users[1]?.ic_masked).toBe('xxxxxx-xx-xx55')
      expect(port.enrolled.get('500')).toHaveLength(2)
      const log = await audits('comp_students.registered')
      expect(log).toHaveLength(1)
      expect(log[0]?.detail).toMatchObject({ lines: 2, created: 2, skipped: 0, failed: 0 })
      expect(JSON.stringify(log[0]?.detail)).not.toMatch(/0701|8802|Aina/)
    })

    it('fails a bad line and a short IC with the exact messages and the original line numbers; skips a repeat and a known IC', async () => {
      const text = ['Tanpa Koma 070101010101', '', 'Ali Pendek, 12345', 'Cita Contoh, 990303-03-0303', 'Cita Ulang, 990303030303', 'Aina Ulang, 070101-01-0101', ', 123456'].join('\n')
      const res = await register({ students: text })
      expect(res.status).toBe(201)
      expect(res.body.status).toBe('1 pelajar komplimen berjaya didaftarkan.')
      expect(StudentImportResultSchema.parse(res.body.data)).toEqual({
        created: 1,
        skipped: 2,
        failed: 3,
        errors: [
          { line: 1, message: 'Format baris tidak sah. Gunakan NAMA, NOKP.' },
          { line: 3, message: 'No. KP mesti sekurang-kurangnya 6 digit.' },
          { line: 7, message: 'Format baris tidak sah. Gunakan NAMA, NOKP.' },
        ],
      })
    })

    it('accepts an IC of 6 digits and keeps only its mask', async () => {
      const res = await register({ students: 'Enam Contoh, 654321' })
      expect(res.body.data.created).toBe(1)
      const row = (await t.db.query<{ ic_masked: string }>(`select ic_masked from users where name = 'Enam Contoh'`))[0]
      expect(row?.ic_masked).toBe('xxxxxx-xx-xx21')
    })

    it('422 without the required fields and for a bad classroom, date or unknown key', async () => {
      expect(Object.keys(fieldsOf(await admin.post('/admin/comp-students', {}))).sort()).toEqual(['classroomId', 'packageExpiresAt', 'students'])
      expect(fieldsOf(await register({ classroomId: '999' })).classroomId).toBe('The selected classroom id is invalid.')
      expect(fieldsOf(await register({ packageExpiresAt: '2026-02-30' })).packageExpiresAt).toBe('The package expires at field must be a valid date.')
      expect(fieldsOf(await register({ students: '' })).students).toBe('The students field is required.')
      expect(fieldsOf(await register({ role: 'admin' })).role).toBe('The role field is not allowed.')
    })

    it('413 for more than 1000 lines', async () => {
      const students = Array.from({ length: 1001 }, (_v, i) => `N${String(i)}, ${String(100000 + i)}`).join('\n')
      const res = await register({ students })
      expect(res.status).toBe(413)
      expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE')
    })
  })

  describe('with no classroom owner wired (default port)', () => {
    let bare: SubTestApp
    beforeAll(async () => {
      bare = await bootSubApp()
    })
    afterAll(async () => {
      await bare.close()
    })

    it('every classroom is invalid (BE-17 is not built), nothing is created', async () => {
      const api = apiOf(await login(bare, ADMIN))
      const res = await api.post('/admin/comp-students', { classroomId: '1', packageExpiresAt: '2026-12-31', students: 'Ali, 123456' })
      expect(fieldsOf(res).classroomId).toBe('The selected classroom id is invalid.')
      expect(await bare.db.query(`select 1 from comp_students`)).toHaveLength(0)
    })
  })

  describe('list and detail', () => {
    it('lists newest first, 50 per page, with the counts over all students; the masked IC and the class view from the port', async () => {
      // 52 more students straight into the tables (older than the registered ones).
      for (let i = 0; i < 52; i++) {
        const [u] = await t.db.query<{ id: string }>(
          `insert into users (name, email, school_id, grade, ic_masked, is_complimentary, created_at) values ($1, $2, $3, 10, 'xxxxxx-xx-xx99', true, '2020-01-01') returning id::text`,
          [`Lama ${String(i)}`, `lama.${String(i)}@ujian.test`, s1],
        )
        await t.db.query(`insert into comp_students (user_id, coins_enabled, package_expires_on, created_at) values ($1, $2, '2026-12-31', '2020-01-01')`, [u?.id, i % 2 === 0])
      }
      const first = await admin.get('/admin/comp-students')
      expect(first.status).toBe(200)
      expect(first.headers['cache-control']).toBe('no-store')
      expect(first.body.data).toHaveLength(50)
      const items = (first.body.data as unknown[]).map((r) => CompStudentListItemSchema.parse(r))
      expect(items[0]?.name).toBe('Enam Contoh') // the newest registered
      const aina = items.find((i) => i.name === 'Aina Contoh')
      expect(aina).toMatchObject({ icMasked: 'xxxxxx-xx-xx01', schoolName: 'SMK Demo Satu', classLabel: '4 Amanah', teacherName: 'Guru Demo', isActive: true, coinsEnabled: false, packageExpiresAt: '2026-12-31' })
      expect(aina?.username).toMatch(/@prestasiplus\.my$/)
      const total = Number((await t.db.query<{ n: string }>(`select count(*)::text n from comp_students`))[0]?.n)
      const coinsOff = Number((await t.db.query<{ n: string }>(`select count(*)::text n from comp_students where not coins_enabled`))[0]?.n)
      expect(first.body.meta).toMatchObject({ page: 1, pageSize: 50, totalItems: total, totalPages: 2, counts: { coinsOff, total } })
      const second = await admin.get('/admin/comp-students?page=2')
      expect(second.body.data).toHaveLength(total - 50)
      expect(second.body.meta).toMatchObject({ page: 2, from: 51 })
      for (const bad of ['0', '-1', 'abc']) expect((await admin.get(`/admin/comp-students?page=${bad}`)).body.meta.page).toBe(1)
      const names = new Set([...(first.body.data as { name: string }[]), ...(second.body.data as { name: string }[])].map((r) => r.name))
      expect(names.size).toBe(total)
      expect(JSON.stringify(first.body)).not.toMatch(/ic_hash|icNumber|070101/)
    })

    it('shows the detail with the classes; balances are read-only zeros; 404 unless a complimentary student', async () => {
      const id = await compUser('Aina Contoh')
      const res = await admin.get(`/admin/comp-students/${id}`)
      expect(res.status).toBe(200)
      expect(res.headers['cache-control']).toBe('no-store')
      expect(CompStudentDetailSchema.parse(res.body.data)).toMatchObject({
        userId: id,
        name: 'Aina Contoh',
        icMasked: 'xxxxxx-xx-xx01',
        classLevel: 'T4',
        isActive: true,
        coinsEnabled: false,
        packageExpiresAt: '2026-12-31',
        originalSchoolName: 'SMK Demo Satu',
        classLabel: '4 Amanah',
        teacherName: 'Guru Demo',
        syilingBalance: 0,
        coinBalance: 0,
        classes: [{ name: '4 Amanah', classCode: 'ABC123', subjectName: 'Sejarah', teacherName: 'Guru Demo', status: 'active' }],
      })
      expectError(await admin.get(`/admin/comp-students/${await userIdOf(t.db, STUDENT)}`), 'NOT_FOUND')
      expectError(await admin.get('/admin/comp-students/999999'), 'NOT_FOUND')
      expectError(await admin.get('/admin/comp-students/abc'), 'NOT_FOUND')
    })
  })

  describe('toggles and bulk action (audited with the actor)', () => {
    it('toggle-coins flips the flag and back, with the exact message and an audit row each time', async () => {
      const id = await compUser('Budi Contoh')
      const on = await admin.post(`/admin/comp-students/${id}/toggle-coins`)
      expect(on.status).toBe(200)
      expect(on.body).toEqual({ data: { coinsEnabled: true }, status: 'Tindakan berjaya dilaksanakan.' })
      expect((await admin.post(`/admin/comp-students/${id}/toggle-coins`)).body.data).toEqual({ coinsEnabled: false })
      const log = (await audits('comp_students.coins_toggled')).filter((a) => a.target_id === id)
      expect(log.map((a) => a.detail.coinsEnabled)).toEqual([true, false])
      expect(new Set(log.map((a) => a.actor_role))).toEqual(new Set(['admin']))
      expect(log[0]?.actor_user_id).toBe(await userIdOf(t.db, ADMIN))
    })

    it('toggle-active flips the account, revokes its sessions when it is switched off, and audits', async () => {
      // The seeded pupil becomes a complimentary student so the test can sign in as it.
      const pupil = await userIdOf(t.db, STUDENT)
      await t.db.query(`update users set is_complimentary = true where id = $1`, [pupil])
      await t.db.query(`insert into comp_students (user_id, package_expires_on) values ($1, '2026-12-31')`, [pupil])
      const session = await login(t, STUDENT)
      expect((await session.agent.get('/api/session')).status).toBe(200)

      const off = await admin.post(`/admin/comp-students/${pupil}/toggle-active`)
      expect(off.body).toEqual({ data: { isActive: false }, status: 'Tindakan berjaya dilaksanakan.' })
      expect((await session.agent.get('/api/session')).status).toBe(401)
      const on = await admin.post(`/admin/comp-students/${pupil}/toggle-active`)
      expect(on.body.data).toEqual({ isActive: true })
      const log = (await audits('comp_students.active_toggled')).filter((a) => a.target_id === pupil)
      expect(log.map((a) => a.detail.isActive)).toEqual([false, true])
    })

    it('404 for a user that is not a complimentary student', async () => {
      const teacher = await userIdOf(t.db, 'guru@demo.test')
      expectError(await admin.post(`/admin/comp-students/${teacher}/toggle-coins`), 'NOT_FOUND')
      expectError(await admin.post(`/admin/comp-students/${teacher}/toggle-active`), 'NOT_FOUND')
      expectError(await admin.post('/admin/comp-students/999999/toggle-coins'), 'NOT_FOUND')
    })

    it('bulk action: coins on and off, deactivate and activate; foreign ids are ignored and `updated` counts the applied ones', async () => {
      const a = await compUser('Aina Contoh')
      const b = await compUser('Budi Contoh')
      const teacher = await userIdOf(t.db, 'guru@demo.test')
      const coinsOn = await admin.post('/admin/comp-students/bulk-action', { action: 'coins_on', ids: [a, b, teacher, '999999', a] })
      expect(coinsOn.status).toBe(200)
      expect(coinsOn.body).toEqual({ data: { updated: 2 }, status: 'Tindakan berjaya dilaksanakan.' })
      const state = async () => (await t.db.query<{ coins_enabled: boolean }>(`select coins_enabled from comp_students where user_id in ($1, $2) order by user_id`, [a, b])).map((r) => r.coins_enabled)
      expect(await state()).toEqual([true, true])
      await admin.post('/admin/comp-students/bulk-action', { action: 'coins_off', ids: [a, b] })
      expect(await state()).toEqual([false, false])
      await admin.post('/admin/comp-students/bulk-action', { action: 'deactivate', ids: [a, b] })
      expect((await t.db.query<{ is_active: boolean }>(`select is_active from users where id in ($1, $2)`, [a, b])).map((r) => r.is_active)).toEqual([false, false])
      expect((await admin.get('/admin/comp-students')).body.data.find((r: { id: string }) => r.id === a).isActive).toBe(false)
      await admin.post('/admin/comp-students/bulk-action', { action: 'activate', ids: [a, b] })
      expect((await t.db.query<{ is_active: boolean }>(`select is_active from users where id in ($1, $2)`, [a, b])).map((r) => r.is_active)).toEqual([true, true])
      // The teacher was never touched.
      expect((await t.db.query<{ is_active: boolean }>(`select is_active from users where id = $1`, [teacher]))[0]?.is_active).toBe(true)
      const log = (await audits('comp_students.bulk_action')).filter((l) => l.target_id === a)
      expect(log.map((l) => l.detail.action)).toEqual(['coins_on', 'coins_off', 'deactivate', 'activate'])
      expect(new Set(log.map((l) => l.actor_role))).toEqual(new Set(['admin']))
    })

    it('bulk action 422 for an unknown action, missing, empty or oversized ids, and unknown keys', async () => {
      expect(fieldsOf(await admin.post('/admin/comp-students/bulk-action', { action: 'delete', ids: ['1'] })).action).toBe('The selected action is invalid.')
      expect(fieldsOf(await admin.post('/admin/comp-students/bulk-action', { action: 'coins_on' })).ids).toBe('The ids field is required.')
      expect(fieldsOf(await admin.post('/admin/comp-students/bulk-action', { action: 'coins_on', ids: [] })).ids).toBe('The ids field is required.')
      const many = Array.from({ length: 201 }, (_v, i) => String(i + 1))
      expect(Object.keys(fieldsOf(await admin.post('/admin/comp-students/bulk-action', { action: 'coins_on', ids: many })))).toEqual(['ids'])
      expect(fieldsOf(await admin.post('/admin/comp-students/bulk-action', { action: 'coins_on', ids: ['1'], x: 1 })).x).toBe('The x field is not allowed.')
    })
  })

  it('an error body is the contract shape', async () => {
    const res = await admin.get('/admin/comp-students/999999')
    expect(ErrorBodySchema.parse(res.body).error.code).toBe('NOT_FOUND')
  })
})
