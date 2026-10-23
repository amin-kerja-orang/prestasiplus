/**
 * Q12 (#226 Q6): accounts shaped exactly as the .cloud migration ETL writes them go through the real HTTP flow:
 * login, the forced-password-change guard, `PUT /me/password`, and the argon2id replacement of the stored hash.
 *
 * The rows are NOT made through the admin API. Each one is the output of the real `transformUser` (the ETL's
 * password decision lives in `decidePassword`) inserted with the loader's column list and `legacy_source = 'cloud'`.
 * Every password here is generated at run time; no real default or credential appears in the repository.
 *
 * Shapes:
 *   A2  `$argon2id$` hash kept, must_reset_password = true (reason non_bcrypt)
 *   B   valid bcrypt (cost 10) equal to a shared default hash, with an e-mail (reason shared_default)
 *   C   roster account: username, no e-mail, valid bcrypt (reason roster_account)
 *   A   non-bcrypt source -> password_hash NULL, flagged
 */
import { randomBytes } from 'node:crypto'

import { hash as argon2Hash } from '@node-rs/argon2'
import { ErrorBodySchema, SessionSchema, type Session } from '@pp/contract'
import type TestAgent from 'supertest/lib/agent'
import type { Response } from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { transformUser } from '../../src/migration/transform/users'
import { decidePassword, IcHasher, parseDefaultHashes } from '../../src/migration/transform/secrets'
import { bcryptHashWithSalt } from '../../src/modules/auth/legacy-bcrypt'
import { type AccountTestApp, bootAccountApp, cookieValue } from '../account/account-helpers'

const BCRYPT_ALPHABET = './ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const salt22 = (): string => Array.from(randomBytes(22), (b) => BCRYPT_ALPHABET[b % 64]).join('')
const secret = (): string => `Pw-${randomBytes(9).toString('hex')}`
const bcrypt10 = (plain: string): string => bcryptHashWithSalt(plain, salt22(), 10, '2y')

const MESSAGE = 'Sila tukar kata laluan anda sebelum meneruskan.'
const ARGON2ID = /^\$argon2id\$/

/** A user as the staging table hands it to the transform (all text, like `staging_cloud.users`). */
const staged = (legacyId: string, schoolLegacy: string, over: Record<string, string | null>) => ({
  id: legacyId,
  name: `Akaun ETL ${legacyId}`,
  email: null,
  username: null,
  password: null,
  role: 'pelajar',
  school_id: schoolLegacy,
  is_active: '1',
  is_suspended: '0',
  is_complimentary: '0',
  ic: null,
  kelas: null,
  created_at: '2026-01-01 00:00:00+00',
  updated_at: '2026-01-02 00:00:00+00',
  ...over,
})

interface Client {
  agent: TestAgent
  csrf: string
  session: Session
  token: string
}

describe('ETL-shaped accounts: login, forced password change, argon2id (Q12)', () => {
  let t: AccountTestApp
  let school1: string
  let school2: string
  const ic = new IcHasher({ IC_HASH_KEY: 'etl-shape-spec-key-0123456789' })

  // Synthetic secrets, one per account.
  const pwA2 = secret()
  const pwB = secret()
  const pwCUnique = secret()
  const pwCShared = secret()
  const pwA = secret()
  let sharedDefaultHash = ''
  let nextLegacy = 5000

  /** transformUser (the real ETL decision) then the loader's INSERT, with its legacy keys and role row. */
  async function loadLikeEtl(row: Record<string, string | null>, schoolId: string): Promise<{ id: string; out: ReturnType<typeof transformUser> }> {
    const out = transformUser(row, {
      schoolId,
      school: { type: 'SMK', state: 'Selangor', district: 'PPD Petaling' },
      ic,
      defaultHashes: parseDefaultHashes(sharedDefaultHash),
    })
    if (!out.ok) throw new Error(`transform rejected: ${JSON.stringify(out.reject)}`)
    const u = out.value.user
    const rows = await t.db.query<{ id: string }>(
      `insert into users (name, email, username, password_hash, must_reset_password, ic_hash, ic_masked, phone, school_id,
                          grade, class_label, bio, is_active, is_suspended, is_complimentary, last_login_at, created_at, updated_at,
                          legacy_source, legacy_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'cloud',$19)
       returning id::text`,
      [
        u.name, u.email, u.username, u.password_hash, u.must_reset_password, u.ic_hash, u.ic_masked, u.phone, u.school_id,
        u.grade, u.class_label, u.bio, u.is_active, u.is_suspended, u.is_complimentary, u.last_login_at, u.created_at, u.updated_at,
        row.id,
      ],
    )
    const id = (rows[0] as { id: string }).id
    await t.db.query(`insert into user_roles (user_id, role) values ($1, $2)`, [id, out.value.role])
    return { id, out }
  }

  const school = async (code: string, name: string): Promise<string> =>
    ((await t.db.query<{ id: string }>(`insert into schools (name, code) values ($1, $2) returning id::text`, [name, code]))[0] as { id: string }).id

  const state = async (id: string) =>
    (await t.db.query<{ password_hash: string | null; must_reset_password: boolean; legacy_source: string | null }>(
      `select password_hash, must_reset_password, legacy_source from users where id = $1`,
      [id],
    ))[0] as { password_hash: string | null; must_reset_password: boolean; legacy_source: string | null }

  const rawLogin = (body: object): Promise<Response> => t.http().post('/api/auth/login').send({ remember: false, ...body })

  async function loginOk(body: { identifier: string; password: string; schoolId?: string }): Promise<Client> {
    const agent = t.agent()
    const res = await agent.post('/api/auth/login').send({ remember: false, ...body })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const session = SessionSchema.parse(res.body.data)
    return { agent, csrf: session.csrf, session, token: cookieValue(res) as string }
  }

  const getApi = (c: Client, path: string) => c.agent.get(`/api${path}`)
  const putApi = (c: Client, path: string, body: object) => c.agent.put(`/api${path}`).set('X-CSRF-Token', c.csrf).send(body)

  const refused = (res: Response): void => {
    expect(res.status, JSON.stringify(res.body)).toBe(403)
    const err = ErrorBodySchema.parse(res.body).error
    expect(err.code).toBe('PASSWORD_CHANGE_REQUIRED')
    expect(err.message).toBe(MESSAGE)
  }

  /** The common path for every flagged shape once the login worked. */
  async function forcedChange(c: Client, id: string, current: string): Promise<void> {
    // Logged in, but every ordinary route is refused.
    expect(c.session.mustChangePassword).toBe(true)
    refused(await getApi(c, '/me'))
    refused(await getApi(c, '/me/settings'))
    refused(await putApi(c, '/me', { name: 'Tukar Nama' }))

    // GET /session is allowed and shows the flag.
    const seen = await getApi(c, '/session')
    expect(seen.status).toBe(200)
    const view = SessionSchema.parse(seen.body.data)
    expect(view.mustChangePassword).toBe(true)

    // Not what the user already has: a wrong current password is the field error and changes nothing.
    const before = await state(id)
    const wrong = await putApi(c, '/me/password', { currentPassword: secret(), password: 'Baharu-1234-x', passwordConfirmation: 'Baharu-1234-x' })
    expect(wrong.status).toBe(422)
    expect(await state(id)).toEqual(before)
    refused(await getApi(c, '/me'))

    // TODO(#228): "new password == current password" is a 422. It is not on this branch tip yet (no such rule in
    // ProfileService.changePassword or the contract schema), so the assertion is left out until #228 merges.

    const next = `Baharu-${randomBytes(8).toString('hex')}`
    const ok = await putApi(c, '/me/password', { currentPassword: current, password: next, passwordConfirmation: next })
    expect(ok.status, JSON.stringify(ok.body)).toBe(200)

    // Flag cleared and the stored hash is argon2id now.
    const after = await state(id)
    expect(after.must_reset_password).toBe(false)
    expect(after.password_hash).toMatch(ARGON2ID)
    expect(after.password_hash).not.toBe(before.password_hash)
    expect(after.legacy_source).toBe('cloud')

    // The rotated session (kept by the agent) is no longer guarded.
    const fresh = SessionSchema.parse((await getApi(c, '/session')).body.data)
    expect(fresh.mustChangePassword).toBe(false)
    expect((await getApi(c, '/me')).status).toBe(200)
    expect((await getApi(c, '/me/settings')).status).toBe(200)

    // The old password is dead and the new one works.
    const ident = c.session.user.email ?? (c.session.user.username as string)
    const scope = c.session.user.email ? {} : { schoolId: c.session.user.schoolId as string }
    expect((await rawLogin({ identifier: ident, password: current, ...scope })).status).toBe(401)
    const again = await loginOk({ identifier: ident, password: next, ...scope })
    expect(again.session.mustChangePassword).toBe(false)
  }

  beforeAll(async () => {
    t = await bootAccountApp()
    school1 = await school('ETLSP01', 'SMK Contoh ETL Satu')
    school2 = await school('ETLSP02', 'SK Contoh ETL Dua')
    sharedDefaultHash = bcrypt10(pwB)
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  describe('the fixtures really have the ETL shape', () => {
    it('decidePassword gives the four shapes the spec relies on', async () => {
      const defaults = new Set([sharedDefaultHash])
      const argon = await argon2Hash(pwA2, { memoryCost: 8192, timeCost: 2, parallelism: 1 })
      expect(decidePassword(argon, { defaultHashes: new Set(), rosterAccount: false })).toEqual({ passwordHash: argon, mustResetPassword: true, reasons: ['non_bcrypt'] })
      const shared = decidePassword(sharedDefaultHash, { defaultHashes: defaults, rosterAccount: false })
      expect(shared).toMatchObject({ passwordHash: sharedDefaultHash, mustResetPassword: true, reasons: ['shared_default'] })
      expect(decidePassword(bcrypt10(pwCUnique), { defaultHashes: new Set(), rosterAccount: true })).toMatchObject({ mustResetPassword: true, reasons: ['roster_account'] })
      expect(decidePassword('plaintext-from-an-old-system', { defaultHashes: new Set(), rosterAccount: false })).toEqual({ passwordHash: null, mustResetPassword: true, reasons: ['non_bcrypt'] })
    })
  })

  describe('A2: $argon2id$ hash kept, flagged non_bcrypt', () => {
    it('logs in, is guarded, changes the password and is cleared', async () => {
      const argon = await argon2Hash(pwA2, { memoryCost: 8192, timeCost: 2, parallelism: 1 })
      const { id, out } = await loadLikeEtl(staged(String(nextLegacy++), '1', { email: 'a2.etl@contoh.invalid', password: argon }), school1)
      expect(out.ok && out.value.notes.resetReasons).toEqual(['non_bcrypt'])
      const row = await state(id)
      expect(row).toMatchObject({ password_hash: argon, must_reset_password: true, legacy_source: 'cloud' })

      expect((await rawLogin({ identifier: 'a2.etl@contoh.invalid', password: secret() })).status).toBe(401)
      const c = await loginOk({ identifier: 'a2.etl@contoh.invalid', password: pwA2 })
      await forcedChange(c, id, pwA2)
    })
  })

  describe('B: bcrypt cost 10 equal to a shared default hash, with e-mail', () => {
    it('logs in, is guarded, changes the password and is cleared; a sibling on the same shared hash stays flagged', async () => {
      const first = await loadLikeEtl(staged(String(nextLegacy++), '1', { email: 'B1.ETL@Contoh.Invalid', password: sharedDefaultHash }), school1)
      const second = await loadLikeEtl(staged(String(nextLegacy++), '1', { email: 'b2.etl@contoh.invalid', password: sharedDefaultHash }), school1)
      expect(first.out.ok && first.out.value.notes.resetReasons).toEqual(['shared_default'])
      expect(await state(first.id)).toMatchObject({ password_hash: sharedDefaultHash, must_reset_password: true })

      const c = await loginOk({ identifier: 'b1.etl@contoh.invalid', password: pwB })
      expect(c.session.mustChangePassword).toBe(true)
      // The bcrypt login rehashes to argon2id on its own, before any change of password; the flag stays.
      expect((await state(first.id)).password_hash).toMatch(ARGON2ID)
      expect((await state(first.id)).must_reset_password).toBe(true)
      await forcedChange(c, first.id, pwB)

      // The sibling shares the same default hash: still flagged, still on the default, unaffected by B1's change.
      expect(await state(second.id)).toMatchObject({ password_hash: sharedDefaultHash, must_reset_password: true })
      const sib = await loginOk({ identifier: 'b2.etl@contoh.invalid', password: pwB })
      expect(sib.session.mustChangePassword).toBe(true)
      refused(await getApi(sib, '/me'))
    })
  })

  describe('C: roster account (username, no e-mail, valid bcrypt)', () => {
    it('non-ambiguous username: logs in by username alone, is guarded, changes password, is cleared', async () => {
      const { id, out } = await loadLikeEtl(staged(String(nextLegacy++), '1', { username: 'Murid.Unik', password: bcrypt10(pwCUnique) }), school1)
      expect(out.ok && out.value.user.email).toBeNull()
      expect(out.ok && out.value.notes.resetReasons).toEqual(['roster_account'])
      expect(await state(id)).toMatchObject({ must_reset_password: true, legacy_source: 'cloud' })

      expect((await rawLogin({ identifier: 'murid.unik', password: secret() })).status).toBe(401)
      const c = await loginOk({ identifier: 'MURID.UNIK', password: pwCUnique })
      expect(c.session.user).toMatchObject({ email: null, schoolId: school1 })
      await forcedChange(c, id, pwCUnique)
    })

    it('ambiguous username (same username and password in two schools): 422 AMBIGUOUS_USERNAME, then schoolId works', async () => {
      const shared = bcrypt10(pwCShared)
      const one = await loadLikeEtl(staged(String(nextLegacy++), '1', { username: 'murid.kembar', password: shared }), school1)
      const two = await loadLikeEtl(staged(String(nextLegacy++), '2', { username: 'murid.kembar', password: shared }), school2)

      const amb = await rawLogin({ identifier: 'murid.kembar', password: pwCShared })
      expect(amb.status).toBe(422)
      const err = ErrorBodySchema.parse(amb.body).error
      expect(err.code).toBe('AMBIGUOUS_USERNAME')
      expect(err.details).toEqual({
        schools: [
          { id: school1, name: 'SMK Contoh ETL Satu' },
          { id: school2, name: 'SK Contoh ETL Dua' },
        ],
      })
      expect(cookieValue(amb)).toBeUndefined()
      // Nothing was changed by the ambiguous answer.
      expect((await state(one.id)).must_reset_password).toBe(true)
      expect((await state(two.id)).must_reset_password).toBe(true)

      const c = await loginOk({ identifier: 'murid.kembar', password: pwCShared, schoolId: school2 })
      expect(c.session.user.schoolId).toBe(school2)
      await forcedChange(c, two.id, pwCShared)

      // The twin in the other school is untouched: still flagged, still on its migrated hash.
      expect(await state(one.id)).toMatchObject({ password_hash: shared, must_reset_password: true })
      const other = await loginOk({ identifier: 'murid.kembar', password: pwCShared, schoolId: school1 })
      expect(other.session.mustChangePassword).toBe(true)
      refused(await getApi(other, '/me'))
    })
  })

  describe('A: non-bcrypt source -> NULL password hash, flagged', () => {
    it('can never log in: 401 INVALID_CREDENTIALS (never a 500) for an e-mail and for a roster username', async () => {
      const withEmail = await loadLikeEtl(staged(String(nextLegacy++), '1', { email: 'a.null@contoh.invalid', password: pwA }), school1)
      const roster = await loadLikeEtl(staged(String(nextLegacy++), '1', { username: 'murid.null', password: pwA }), school1)
      for (const { id, out } of [withEmail, roster]) {
        expect(out.ok && out.value.user.password_hash).toBeNull()
        expect(await state(id)).toMatchObject({ password_hash: null, must_reset_password: true, legacy_source: 'cloud' })
      }

      // Even the plaintext the source held does not work: the clear value never reached v2.
      for (const body of [
        { identifier: 'a.null@contoh.invalid', password: pwA },
        { identifier: 'a.null@contoh.invalid', password: secret() },
        { identifier: 'murid.null', password: pwA },
        { identifier: 'murid.null', password: secret(), schoolId: school1 },
      ]) {
        const res = await rawLogin(body)
        expect(res.status, JSON.stringify(res.body)).toBe(401)
        expect(ErrorBodySchema.parse(res.body).error.code).toBe('INVALID_CREDENTIALS')
        expect(cookieValue(res)).toBeUndefined()
      }
      // The row is untouched by the failures.
      expect(await state(withEmail.id)).toMatchObject({ password_hash: null, must_reset_password: true })
    })
  })
})
