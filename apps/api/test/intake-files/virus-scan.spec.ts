import type { RoleGrant } from '@pp/contract'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { AuthContext } from '../../src/common/scope/auth-context'
import { ApiError } from '../../src/common/errors/api-error'
import { INTAKE_SCAN_MESSAGES, INTAKE_SCAN_UNAVAILABLE_CODE, IntakeUploadService } from '../../src/modules/intake/files/intake-upload.service'
import { eicar, FakeClamd } from '../support/fake-clamd'
import { bootIntakeApp, countRows, createBatch, expectFilesError, type IntakeTestApp, loginAs, type LoggedIn, uploadFiles, uploadOk } from './helpers'
import { textPdf } from './pdf-fixtures'

/** Backlog #78: teacher and admin intake uploads are scanned by ClamAV (fake clamd on the wire protocol) before anything is stored. */

/** A tiny DOCX-shaped ZIP (stored entries); `payload` is the content of every entry. */
function docx(payload: Buffer): Buffer {
  const names = ['[Content_Types].xml', '_rels/.rels', 'word/document.xml']
  const local: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const name of names) {
    const n = Buffer.from(name, 'latin1')
    const lh = Buffer.alloc(30)
    lh.writeUInt32LE(0x04034b50, 0)
    lh.writeUInt16LE(20, 4)
    lh.writeUInt32LE(payload.length, 18)
    lh.writeUInt32LE(payload.length, 22)
    lh.writeUInt16LE(n.length, 26)
    const ch = Buffer.alloc(46)
    ch.writeUInt32LE(0x02014b50, 0)
    ch.writeUInt16LE(20, 4)
    ch.writeUInt16LE(20, 6)
    ch.writeUInt32LE(payload.length, 20)
    ch.writeUInt32LE(payload.length, 24)
    ch.writeUInt16LE(n.length, 28)
    ch.writeUInt32LE(offset, 42)
    local.push(lh, n, payload)
    central.push(ch, n)
    offset += lh.length + n.length + payload.length
  }
  const cd = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(names.length, 8)
  end.writeUInt16LE(names.length, 10)
  end.writeUInt32LE(cd.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...local, cd, end])
}

const who = { ip: null, requestId: null }

async function authOf(t: IntakeTestApp, email: string, role: 'admin' | 'teacher'): Promise<AuthContext> {
  const id = String((await t.db.query<{ id: string }>(`select id::text id from users where email = $1`, [email]))[0]!.id)
  return {
    sessionRowId: '0',
    userId: id,
    roles: [] as RoleGrant[],
    active: { role, scope: role === 'admin' ? { level: 'national' } : { level: 'school' } },
    mode: null,
    capabilities: [],
    mustChangePassword: false,
  } as unknown as AuthContext
}

const infectedPdf = (seed: number): Buffer => Buffer.concat([textPdf(1, seed), eicar()])

async function nothingStored(t: IntakeTestApp): Promise<void> {
  expect(await countRows(t.db, 'files')).toBe(0)
  expect(await countRows(t.db, 'intake_files')).toBe(0)
  expect(await countRows(t.db, 'jobs')).toBe(0)
}

describe('intake upload virus scan with a configured scanner', () => {
  const clamd = new FakeClamd()
  let t: IntakeTestApp
  let admin: LoggedIn
  let teacher: LoggedIn
  let teacherAuth: AuthContext

  beforeAll(async () => {
    await clamd.start()
    t = await bootIntakeApp({ CLAMAV_HOST: '127.0.0.1', CLAMAV_PORT: String(clamd.port), CLAMAV_TIMEOUT_MS: '1000' }, undefined, undefined, 'real')
    admin = await loginAs(t, 'admin@demo.test')
    teacher = await loginAs(t, 'guru@demo.test')
    teacherAuth = await authOf(t, 'guru@demo.test', 'teacher')
  }, 120_000)
  afterAll(async () => {
    await t.close()
    await clamd.stop()
  })
  beforeEach(async () => {
    clamd.mode = 'scan'
    clamd.scans = 0
    await t.db.query(`delete from audit_events where action = 'intake.file_infected'`)
  })

  it('admin: a clean PDF is scanned and accepted', async () => {
    const b = await createBatch(admin)
    const out = await uploadOk(admin, b.id, [{ bytes: textPdf(1, 801) }])
    expect(out.files).toHaveLength(1)
    expect(clamd.scans).toBe(1)
  })

  it('admin: an infected PDF is refused (422, BM message), nothing is stored, an audit event is written', async () => {
    const b = await createBatch(admin)
    const bytes = infectedPdf(802)
    expectFilesError(await uploadFiles(admin, b.id, [{ bytes }]), INTAKE_SCAN_MESSAGES.infected)
    await nothingStored(t)
    const audit = await t.db.query<{ detail: { signature: string; sha256: string } }>(`select detail from audit_events where action = 'intake.file_infected'`)
    expect(audit).toHaveLength(1)
    expect(audit[0]!.detail.signature).toBe('Eicar-Test-Signature')
    expect(audit[0]!.detail.sha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it('teacher: an infected PDF is refused the same way', async () => {
    const b = await createBatch(teacher)
    expectFilesError(await uploadFiles(teacher, b.id, [{ bytes: infectedPdf(803) }]), INTAKE_SCAN_MESSAGES.infected)
    await nothingStored(t)
  })

  it('one infected file in a batch of two refuses the whole request, all-or-nothing', async () => {
    const b = await createBatch(admin)
    const res = await uploadFiles(admin, b.id, [{ bytes: textPdf(1, 804) }, { bytes: infectedPdf(805) }])
    expectFilesError(res, INTAKE_SCAN_MESSAGES.infected)
    await nothingStored(t)
  })

  it('teacher DOCX (guru path, acceptOffice): clean is stored, infected is refused with an audit event', async () => {
    const svc = t.app.get(IntakeUploadService)
    const b = await createBatch(teacher)
    const ok = await svc.upload(teacherAuth, b.id, [{ buffer: docx(Buffer.from('<x>soalan bersih</x>')), originalname: 'soalan.docx' }], who, undefined, { acceptOffice: true })
    expect(ok.files).toHaveLength(1)
    const before = await countRows(t.db, 'files')

    const b2 = await createBatch(teacher)
    const bad = await svc.upload(teacherAuth, b2.id, [{ buffer: docx(eicar()), originalname: 'virus.docx' }], who, undefined, { acceptOffice: true }).catch((e: unknown) => e)
    expect(bad).toBeInstanceOf(ApiError)
    expect((bad as ApiError).code).toBe('VALIDATION_ERROR')
    expect((bad as ApiError).fields?.files).toBe(INTAKE_SCAN_MESSAGES.infected)
    expect(await countRows(t.db, 'files')).toBe(before)
    const audit = await t.db.query<{ detail: { name: string } }>(`select detail from audit_events where action = 'intake.file_infected'`)
    expect(audit.map((r) => r.detail.name)).toEqual(['virus.docx'])
  })

  it.each([['hang'], ['drop'], ['error-reply'], ['garbage']] as const)('FAIL CLOSED: scanner mode %s refuses the upload with a 503 "cuba lagi" message and stores nothing', async (mode) => {
    clamd.mode = mode
    const b = await createBatch(teacher)
    const res = await uploadFiles(teacher, b.id, [{ bytes: textPdf(1, 810) }])
    expect(res.status).toBe(503)
    expect(res.body.error.code).toBe(INTAKE_SCAN_UNAVAILABLE_CODE)
    expect(res.body.error.message).toBe(INTAKE_SCAN_MESSAGES.unavailable)
    expect(res.body.error.fields.files).toBe(INTAKE_SCAN_MESSAGES.unavailable)
    await nothingStored(t)
  })

  it('FAIL CLOSED: a stopped scanner (connection refused) refuses a teacher DOCX', async () => {
    const dead = new FakeClamd()
    const port = await dead.start()
    await dead.stop()
    const svc = t.app.get(IntakeUploadService) as unknown as { scanner: { config: { port: number } } }
    const original = svc.scanner.config.port
    ;(svc.scanner.config as { port: number }).port = port
    try {
      const b = await createBatch(teacher)
      const err = await t.app
        .get(IntakeUploadService)
        .upload(teacherAuth, b.id, [{ buffer: docx(Buffer.from('<x>y</x>')), originalname: 'a.docx' }], who, undefined, { acceptOffice: true })
        .catch((e: unknown) => e)
      expect((err as ApiError).code).toBe(INTAKE_SCAN_UNAVAILABLE_CODE)
      expect((err as ApiError).getStatus()).toBe(503)
      await nothingStored(t)
    } finally {
      ;(svc.scanner.config as { port: number }).port = original
    }
  })

  it('a file of the wrong type is refused as before, without a scan', async () => {
    const b = await createBatch(admin)
    const res = await uploadFiles(admin, b.id, [{ bytes: Buffer.from('plain text') }])
    expect(res.status).toBe(422)
    expect(clamd.scans).toBe(0)
  })
})

describe('intake upload virus scan: required but no scanner configured (INTAKE_TEACHER_ENABLED on, CLAMAV_HOST empty)', () => {
  let t: IntakeTestApp
  let admin: LoggedIn
  let teacher: LoggedIn

  beforeAll(async () => {
    t = await bootIntakeApp({ CLAMAV_HOST: undefined, INTAKE_TEACHER_ENABLED: 'true' }, undefined, undefined, 'real')
    admin = await loginAs(t, 'admin@demo.test')
    teacher = await loginAs(t, 'guru@demo.test')
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('FAIL CLOSED: uploads are refused with 503, never accepted unscanned', async () => {
    for (const who of [teacher, admin]) {
      const b = await createBatch(who)
      const res = await uploadFiles(who, b.id, [{ bytes: textPdf(1, 820) }])
      expect(res.status).toBe(503)
      expect(res.body.error.code).toBe(INTAKE_SCAN_UNAVAILABLE_CODE)
    }
    await nothingStored(t)
  })
})

describe('intake upload virus scan: not required (teacher intake off, no CLAMAV_HOST)', () => {
  let t: IntakeTestApp
  let admin: LoggedIn

  beforeAll(async () => {
    t = await bootIntakeApp({ CLAMAV_HOST: undefined, INTAKE_TEACHER_ENABLED: undefined }, undefined, undefined, 'real')
    admin = await loginAs(t, 'admin@demo.test')
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('admin uploads are accepted as before (the legacy behaviour until a scanner is configured)', async () => {
    const b = await createBatch(admin)
    expect((await uploadOk(admin, b.id, [{ bytes: textPdf(1, 830) }])).files).toHaveLength(1)
  })
})
