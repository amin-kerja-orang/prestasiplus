/**
 * API-AS-06 `POST /api/admin-sekolah/pelajar/import?dryRun=` (R1-AS-51, S6-T09). Guard SA: the school is the session's.
 * Multipart `csvFile` (+ `level` T1..T5) or JSON. `dryRun` previews the first 10 rows and creates nothing; the real call
 * creates the valid rows as PENDING pupils (`isActive = false`, Admin Pusat approves) inside `ctx.transaction`, enrolling each
 * in the class of the school its `kelas` names. The whole file is refused when the new pupils exceed the remaining seats
 * (`student_quota` minus ALL pupils of the school, pending included). No password is ever returned: a pending pupil gets an
 * unusable random password (`users.create` without `setPassword`), so a school admin resets it after approval.
 *
 * The row rules are those of the real API (`apps/api/.../pupil-import.plan.ts`): "Sila isi nama.", "Format e-mel tidak sah.",
 * "E-mel berulang dalam fail.", "Kelas tidak dijumpai.", "E-mel sudah wujud (dilangkau).".
 */

import { SCHOOL_ADMIN_PUPIL_IMPORT_MESSAGES as MSG } from '@pp/contract'

import { fail, ok, route, validationError, type MockRequest, type RouteDef } from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'
import { schoolQuota, toTitleCase } from '@/modules/m02-users-schools/mock'
import { classrooms } from '@/modules/m10-teacher-class/mock'

import { requireSchoolAdminWithSchool, schoolOf } from '../read-models/school-scope'

const MAX_ROWS = 1000
const MAX_BYTES = 2_097_152
const PREVIEW = 10
const LEVEL_GRADE: Record<string, number> = { T1: 7, T2: 8, T3: 9, T4: 10, T5: 11 }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface Row {
  line: number
  name: string
  email: string
  kelas: string
}

function split(line: string, delimiter: string): string[] {
  const out: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line.charAt(i)
    if (quoted) {
      if (ch === '"' && line.charAt(i + 1) === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"' && cell.trim() === '') quoted = true
    else if (ch === delimiter) {
      out.push(cell.trim())
      cell = ''
    } else cell += ch
  }
  out.push(cell.trim())
  return out
}

/** The data rows, or the missing column name (`nama`). */
function parse(text: string): Row[] | { missing: string } {
  const lines = text.replace(/^﻿/, '').split(/\r\n|\r|\n/)
  const first = lines.findIndex((l) => l.trim() !== '')
  if (first < 0) return []
  const head = lines[first] ?? ''
  const delimiter = head.split(';').length > head.split(',').length ? ';' : ','
  const columns = split(head, delimiter).map((c) => c.toLowerCase())
  if (!columns.includes('nama')) return { missing: 'nama' }
  const at = (cells: string[], name: string): string => cells[columns.indexOf(name)] ?? ''
  const rows: Row[] = []
  lines.forEach((raw, i) => {
    if (i <= first || raw.trim() === '') return
    const cells = split(raw, delimiter)
    rows.push({ line: i + 1, name: at(cells, 'nama'), email: at(cells, 'email'), kelas: at(cells, 'kelas') })
  })
  return rows
}

async function textOf(req: MockRequest): Promise<string | undefined> {
  const body = req.body
  if (typeof body !== 'object' || body === null || Array.isArray(body) || body instanceof Blob) return undefined
  const file = (body as Record<string, unknown>).csvFile
  if (typeof file === 'string') return file
  if (typeof Blob !== 'undefined' && file instanceof Blob) return await file.text()
  return undefined
}

const importRoute = route('POST', '/api/admin-sekolah/pelajar/import', [requireSchoolAdminWithSchool], async (req, ctx) => {
  const viewer = schoolOf(req)
  const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Record<string, unknown>
  const level = typeof body.level === 'string' && body.level.trim() !== '' ? body.level.trim() : undefined
  const dryRun = String(req.query.dryRun ?? '') === 'true'
  if (level !== undefined && !(level in LEVEL_GRADE)) return validationError({ level: 'The selected level is invalid.' })

  const text = await textOf(req)
  if (text === undefined) return validationError({ csvFile: MSG.noFile })
  if (new TextEncoder().encode(text).length > MAX_BYTES) {
    return fail(413, 'PAYLOAD_TOO_LARGE', MSG.tooLarge)
  }
  const rows = parse(text)
  if ('missing' in rows) return validationError({ csvFile: MSG.missingColumn(rows.missing) })
  if (rows.length === 0) return validationError({ csvFile: MSG.noData })
  if (rows.length > MAX_ROWS) return fail(413, 'PAYLOAD_TOO_LARGE', MSG.tooManyRows)

  const quota = schoolQuota(viewer.schoolId)
  if (!quota.hasSubscription) return fail(409, 'NO_SUBSCRIPTION', MSG.noSubscription)

  const classByName = new Map<string, number>()
  for (const c of classrooms.forSchool(viewer.schoolId)) {
    if (c.kind === 'classroom' && c.isActive && !classByName.has(c.name.trim().toLowerCase())) {
      classByName.set(c.name.trim().toLowerCase(), c.classId)
    }
  }

  const errors: { row: number; message: string }[] = []
  const planned: { name: string; email: string; classId: number | null }[] = []
  const seen = new Set<string>()
  let skipped = 0
  for (const r of rows) {
    const bad = (message: string): void => {
      errors.push({ row: r.line, message })
    }
    if (r.name === '') bad(MSG.noName)
    else if ([...r.name].length > 255) bad(MSG.nameLong)
    else if (!EMAIL.test(r.email)) bad(MSG.badEmail)
    else {
      const classId = r.kelas === '' ? undefined : classByName.get(r.kelas.toLowerCase())
      if (classId === undefined && level === undefined) bad(MSG.classNotFound)
      else if (seen.has(r.email.toLowerCase())) bad(MSG.emailRepeated)
      else {
        seen.add(r.email.toLowerCase())
        if (users.findByEmail(r.email)) {
          skipped++
          bad(MSG.emailExists)
        } else planned.push({ name: toTitleCase(r.name), email: r.email, classId: classId ?? null })
      }
    }
  }
  if (planned.length > (quota.remaining ?? 0)) return fail(409, 'QUOTA_FULL', MSG.quotaFull)

  if (dryRun) {
    return ok({
      dryRun: true,
      rows: rows.length,
      created: 0,
      skipped,
      errors,
      preview: rows.slice(0, PREVIEW).map((r) => ({
        row: r.line,
        name: r.name,
        email: r.email === '' ? null : r.email,
        className: r.kelas === '' ? null : r.kelas,
      })),
    })
  }

  const now = ctx.clock.now()
  ctx.transaction(() => {
    for (const p of planned) {
      const user = users.create(
        {
          name: p.name,
          email: p.email,
          role: 'student',
          grade: level === undefined ? null : (LEVEL_GRADE[level] ?? null),
          schoolId: viewer.schoolId,
          isActive: false,
          createdById: viewer.userId,
        },
        now,
      )
      if (p.classId !== null) classrooms.enrol({ kind: 'classroom', classId: p.classId, studentId: user.id, source: 'school_admin' }, now)
    }
  })
  return ok({ dryRun: false, rows: rows.length, created: planned.length, skipped, errors })
})

export const pupilImportRoutes: RouteDef[] = [importRoute]
