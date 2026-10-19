import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FilesService } from '../../src/modules/files/files.service'
import { makePng } from './fixtures'
import { addAccount, bootFilesApp, expectError, type FilesTestApp, loginAs, type LoggedIn, uploadOk } from './helpers'

/**
 * Read visibility per purpose AND ownership (security F1, LEAD decision). Every refused read is 404 (never
 * 403) and an anonymous caller gets 401 for everything except the public purpose.
 */
type Actor =
  | 'owner'
  | 'sameSchoolStudent'
  | 'otherSchoolStudent'
  | 'teacher'
  | 'schoolAdmin'
  | 'otherSchoolAdmin'
  | 'ppdSameDistrict'
  | 'ppdOtherDistrict'
  | 'admin'
  | 'anonymous'

let t: FilesTestApp
const who = {} as Record<Exclude<Actor, 'anonymous'>, LoggedIn>
let avatar: string
let photo: string
let questionImage: string
let cmsImage: string
let intakePage: string

beforeAll(async () => {
  t = await bootFilesApp()
  await addAccount(t.db, 'murid.lain@demo.test', 'student', 'DEMO002')
  await addAccount(t.db, 'adminsekolah.lain@demo.test', 'school_admin', 'DEMO002')
  await addAccount(t.db, 'ppd.sama@demo.test', 'ppd_officer', 'DEMO001')
  await addAccount(t.db, 'ppd.lain@demo.test', 'ppd_officer', 'DEMO002')
  const logins: Array<[Exclude<Actor, 'anonymous'>, string]> = [
    ['owner', 'pelajar@demo.test'],
    ['sameSchoolStudent', 'pelajar2@demo.test'],
    ['otherSchoolStudent', 'murid.lain@demo.test'],
    ['teacher', 'guru@demo.test'],
    ['schoolAdmin', 'adminsekolah@demo.test'],
    ['otherSchoolAdmin', 'adminsekolah.lain@demo.test'],
    ['ppdSameDistrict', 'ppd.sama@demo.test'],
    ['ppdOtherDistrict', 'ppd.lain@demo.test'],
    ['admin', 'admin@demo.test'],
  ]
  for (const [key, email] of logins) who[key] = await loginAs(t, email)

  avatar = (await uploadOk(who.owner, 'avatar', makePng())).url
  photo = (await uploadOk(who.owner, 'bijak_photo', makePng())).url
  questionImage = (await uploadOk(who.teacher, 'question_image', makePng())).url
  cmsImage = (await uploadOk(who.admin, 'cms_image', makePng())).url
  const adminId = (await t.db.query<{ id: string }>(`select id::text as id from users where email = 'admin@demo.test'`))[0]?.id as string
  const derived = await t.app.get(FilesService).storeDerived({ ownerUserId: adminId, purpose: 'intake_page', bytes: makePng() })
  intakePage = `/api/files/${derived.publicId}`
})
afterAll(async () => {
  await t.close()
})

async function get(actor: Actor, url: string) {
  return actor === 'anonymous' ? t.http().get(url) : who[actor].agent.get(url)
}

const MATRIX: Array<{ purpose: string; url: () => string; allowed: Actor[]; anonymous: 200 | 401 }> = [
  {
    // owner, admin, and staff whose scope covers the owner. Not classmates, not other schools, not (yet) teachers.
    purpose: 'avatar of a student',
    url: () => avatar,
    allowed: ['owner', 'schoolAdmin', 'ppdSameDistrict', 'admin'],
    anonymous: 401,
  },
  { purpose: 'bijak_photo', url: () => photo, allowed: ['owner'], anonymous: 401 },
  // staff only (admin and teacher); the owner here is the teacher
  { purpose: 'question_image', url: () => questionImage, allowed: ['teacher', 'admin'], anonymous: 401 },
  {
    purpose: 'cms_image (public, interim until the BE-24 publish gate)',
    url: () => cmsImage,
    allowed: [
      'owner', 'sameSchoolStudent', 'otherSchoolStudent', 'teacher', 'schoolAdmin', 'otherSchoolAdmin',
      'ppdSameDistrict', 'ppdOtherDistrict', 'admin',
    ],
    anonymous: 200,
  },
  { purpose: 'derived intake file', url: () => intakePage, allowed: ['admin'], anonymous: 401 },
]

const ACTORS: Actor[] = [
  'owner', 'sameSchoolStudent', 'otherSchoolStudent', 'teacher', 'schoolAdmin', 'otherSchoolAdmin',
  'ppdSameDistrict', 'ppdOtherDistrict', 'admin', 'anonymous',
]

describe.each(MATRIX)('read visibility: $purpose', (row) => {
  it.each(ACTORS)('%s', async (actor) => {
    const res = await get(actor, row.url())
    if (actor === 'anonymous') {
      expect(res.status).toBe(row.anonymous)
      if (row.anonymous === 401) expectError(res, 'UNAUTHORIZED')
    } else if (row.allowed.includes(actor)) {
      expect(res.status, actor).toBe(200)
    } else {
      expectError(res, 'NOT_FOUND') // never 403
    }
  })
})

describe('avatar rules in detail', () => {
  it('cross-school access is 404 for school admins, PPD officers and students of another school', async () => {
    for (const actor of ['otherSchoolAdmin', 'ppdOtherDistrict', 'otherSchoolStudent'] as const) {
      expectError(await get(actor, avatar), 'NOT_FOUND')
    }
  })

  it('classmates and users of the same school are not entitled (leaderboards are not this card)', async () => {
    expectError(await get('sameSchoolStudent', avatar), 'NOT_FOUND')
  })

  it('a teacher gets 404 for another user\'s avatar until class membership exists (BE-17, fail closed)', async () => {
    expectError(await get('teacher', avatar), 'NOT_FOUND')
  })

  it('a teacher reads their own avatar, and the school admin of the same school reads a teacher avatar', async () => {
    const own = (await uploadOk(who.teacher, 'avatar', makePng())).url
    expect((await get('teacher', own)).status).toBe(200)
    expect((await get('schoolAdmin', own)).status).toBe(200)
    expectError(await get('otherSchoolAdmin', own), 'NOT_FOUND')
    expectError(await get('owner', own), 'NOT_FOUND')
  })

  it('the avatar of a user with no school is visible to the owner and admin only', async () => {
    const own = (await uploadOk(who.admin, 'avatar', makePng())).url
    expect((await get('admin', own)).status).toBe(200)
    for (const actor of ['schoolAdmin', 'ppdSameDistrict', 'teacher', 'owner'] as const) {
      expectError(await get(actor, own), 'NOT_FOUND')
    }
  })
})

describe('Mod Pelajar uses the active role (student), not the account roles', () => {
  it('an admin in Mod Pelajar loses the admin read rights and keeps the public ones', async () => {
    const a = await loginAs(t, 'admin@demo.test')
    const teacherId = (await t.db.query<{ id: string }>(`select id::text as id from users where email = 'guru@demo.test'`))[0]?.id as string
    const theirs = await t.app.get(FilesService).storeDerived({ ownerUserId: teacherId, purpose: 'intake_page', bytes: makePng() })
    expect((await a.agent.get(avatar)).status).toBe(200) // admin role
    expect((await a.agent.get(`/api/files/${theirs.publicId}`)).status).toBe(200)
    const mode = await a.agent.post('/api/session/mode').set('X-CSRF-Token', a.csrf).send({ mode: 'mod_pelajar' })
    expect(mode.status).toBe(200)
    expectError(await a.agent.get(avatar), 'NOT_FOUND')
    expectError(await a.agent.get(questionImage), 'NOT_FOUND')
    expectError(await a.agent.get(`/api/files/${theirs.publicId}`), 'NOT_FOUND') // someone else's derived file
    expect((await a.agent.get(intakePage)).status).toBe(200) // owned by this account: ownership still holds (the mode acts as the own account)
    expect((await a.agent.get(cmsImage)).status).toBe(200)
  })
})

describe('no oracle', () => {
  it('a refused read and an unknown token look the same (404, same body shape and message)', async () => {
    const refused = await get('sameSchoolStudent', photo)
    const unknown = await who.sameSchoolStudent.agent.get('/api/files/AAAAAAAAAAAAAAAAAAAAAA')
    expect(refused.status).toBe(unknown.status)
    expect(refused.body.error.code).toBe(unknown.body.error.code)
    expect(refused.body.error.message).toBe(unknown.body.error.message)
  })
})
