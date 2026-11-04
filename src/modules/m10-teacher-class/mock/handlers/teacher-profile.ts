/**
 * API-GUR-22 (S5-T05 part C), served in mock mode with the shapes and role rules of the real API
 * (`apps/api/src/modules/account/teacher-profile.*`):
 * - `GET /api/account/teacher-profile` (teacher, own): `{name, bio, icMasked, subject, qualification,
 *   experienceYears, school: {name} | null}`; the IC only masked, the school read-only (the user school);
 * - `PUT /api/account/teacher-profile` `{name, bio?, ic?, subject?, qualification?, experienceYears?}`:
 *   writes name and bio to the user, the IC as hash and mask only, the teaching details to the
 *   `teacherProfiles` store; `schoolId`, `phone` and `email` are ignored; PRD BM errors; status
 *   "Profil dikemaskini.". (The real API also refuses an IC another account holds; the mock keeps only
 *   salted hashes per user, so it does not.)
 * - `GET /api/public/teachers/:id` (teacher, admin, school admin): `{name, subject, bio, qualification,
 *   experienceYears}`; any other role, an unknown id or a non-teacher: uniform 404.
 */

import { notFound, ok, requireAuth, requireRole, route, validationError, type RouteDef } from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'
import { schools } from '@/modules/m02-users-schools/mock'

import { teacherProfilesRepo } from '../repository/teacher-profiles'
import { bodyOf, MSG, viewerId } from './common'

const TEXT = {
  nameRequired: 'Sila isi nama penuh.',
  nameMax: 'Nama penuh tidak boleh melebihi 255 aksara.',
  bioMax: 'Bio tidak boleh melebihi 1000 aksara.',
  icFormat: 'No. IC mesti 12 digit tanpa sempang.',
  subjectMax: 'Subjek utama tidak boleh melebihi 100 aksara.',
  qualificationMax: 'Kelayakan tidak boleh melebihi 150 aksara.',
  experienceRange: 'Pengalaman mesti antara 0 dan 60 tahun.',
  saved: 'Profil dikemaskini.',
} as const

const CARD_READERS: readonly string[] = ['teacher', 'admin', 'school_admin']

const textOf = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)

function profileOf(userId: number) {
  const user = users.get(userId)
  if (!user) return null
  const teaching = teacherProfilesRepo.forUser(userId)
  const school = user.schoolId === null ? undefined : schools.get(user.schoolId)
  return {
    name: user.name,
    bio: user.bio ?? null,
    icMasked: users.icMasked(userId),
    subject: teaching?.subject ?? null,
    qualification: teaching?.qualification ?? null,
    experienceYears: teaching?.experienceYears ?? 0,
    school: school ? { name: school.name } : null,
  }
}

export const teacherProfileRoutes: RouteDef[] = [
  route('GET', '/api/account/teacher-profile', [requireRole('teacher')], (req) => {
    const profile = profileOf(viewerId(req))
    return profile ? ok(profile) : notFound(MSG.notFound)
  }),

  route('PUT', '/api/account/teacher-profile', [requireRole('teacher')], (req, ctx) => {
    const body = bodyOf(req)
    const id = viewerId(req)
    const fields: Record<string, string> = {}
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (name === '') fields.name = TEXT.nameRequired
    else if (name.length > 255) fields.name = TEXT.nameMax
    const bio = typeof body.bio === 'string' ? body.bio.trim() : null
    if (bio !== null && bio.length > 1000) fields.bio = TEXT.bioMax
    const ic = typeof body.ic === 'string' ? body.ic.trim() : ''
    if (ic !== '' && !/^\d{12}$/.test(ic)) fields.ic = TEXT.icFormat
    const subject = typeof body.subject === 'string' ? body.subject.trim() : null
    if (subject !== null && subject.length > 100) fields.subject = TEXT.subjectMax
    const qualification = typeof body.qualification === 'string' ? body.qualification.trim() : null
    if (qualification !== null && qualification.length > 150) fields.qualification = TEXT.qualificationMax
    const years = body.experienceYears
    if (years !== undefined && (typeof years !== 'number' || !Number.isInteger(years) || years < 0 || years > 60)) {
      fields.experienceYears = TEXT.experienceRange
    }
    if (Object.keys(fields).length > 0) return validationError(fields)

    users.update(id, { name, ...('bio' in body ? { bio: textOf(body.bio) } : {}) }, ctx.clock.now())
    if (ic !== '') users.setIcNumber(id, ic)
    teacherProfilesRepo.save(id, {
      ...('subject' in body ? { subject: textOf(body.subject) } : {}),
      ...('qualification' in body ? { qualification: textOf(body.qualification) } : {}),
      ...(typeof years === 'number' ? { experienceYears: years } : {}),
    })
    return ok(profileOf(id), { status: TEXT.saved })
  }),

  route('GET', '/api/public/teachers/:id', [requireAuth()], (req) => {
    if (!CARD_READERS.includes(req.session?.role ?? '')) return notFound(MSG.notFound)
    const target = users.get(Number(req.params.id))
    if (!target || !target.isActive || target.role !== 'teacher') return notFound(MSG.notFound)
    const teaching = teacherProfilesRepo.forUser(target.id)
    return ok({
      name: target.name,
      subject: teaching?.subject ?? null,
      bio: target.bio ?? null,
      qualification: teaching?.qualification ?? null,
      experienceYears: teaching?.experienceYears ?? 0,
    })
  }),
]
