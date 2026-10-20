import type { Scenario } from '@pp/contract-tests'

import { dataOf, errorOf, expectError, listOf } from '../helpers'

const CSV = '﻿tajuk,kod_subjek,kod_tingkatan,nama_fail_audio\n"Contoh: KBAT Sains Bab 1",SCI,T4,kbat-sains-1.mp3\n'

/**
 * BE-18 part B scenarios: the student "Set Soalan Guru" list, the teacher question paper upload (validation
 * only: the intake is BE-37's), the Audio KBAT template downloads and the teacher DSKP picks. The conformance
 * database has no classes or sets, so data is set up through the API or the guards and empty states are asserted.
 */
export const questionSetsScenarios: Scenario[] = [
  {
    id: 'question-sets-api/student list: empty for a fresh pupil, a joined class without sets stays empty',
    domain: 'question-sets',
    targets: ['api'],
    async run(ctx) {
      const student = await ctx.as('student')
      const empty = await student.request('GET', '/set-soalan-saya')
      ctx.expectStatus(empty, 200)
      ctx.check(listOf(empty).length === 0, 'a pupil with no class has no sets')
      const teacher = await ctx.as('teacher')
      const subjects = await teacher.request('GET', '/subjects')
      const subjectId = String(listOf(subjects)[0]?.id)
      const cls = dataOf(await teacher.request('POST', '/guru/classes', { body: { name: 'Kelas Set Soalan', subjectId, educationLevel: 'tingkatan-4' } }))
      ctx.expectStatus(await student.request('POST', '/kelas-saya/join', { body: { classCode: String(cls.joinCode) } }), 201)
      const after = await student.request('GET', '/set-soalan-saya')
      ctx.expectStatus(after, 200)
      ctx.check(listOf(after).length === 0, 'a class without sets shows nothing')
      // any signed-in role may call it
      ctx.expectStatus(await teacher.request('GET', '/set-soalan-saya'), 200)
    },
  },
  {
    id: 'question-sets-api/question paper upload: validation 422 with every failing field, and a bad file',
    domain: 'question-sets',
    targets: ['api'],
    async run(ctx) {
      const teacher = await ctx.as('teacher')
      const none = await teacher.request('POST', '/guru/question-papers', { body: {} })
      expectError(ctx, none, 422, 'VALIDATION_ERROR')
      const fields = errorOf(none).fields as Record<string, string>
      ctx.check(fields.jenisSoalan === 'Sila pilih jenis soalan.', 'jenisSoalan message')
      ctx.check(fields.subject === 'Sila isi matapelajaran.', 'subject message')
      ctx.check(fields.files === 'Sila pilih sekurang-kurangnya satu fail.', 'files message')
      ctx.check(String(errorOf(none).message) === 'Sila pilih jenis soalan. (and 2 more errors)', 'Laravel summary message')

      const bad = await teacher.request('POST', '/guru/question-papers', {
        file: { field: 'files[]', filename: 'program.exe', contentType: 'application/octet-stream', content: new Uint8Array([1, 2, 3]) },
      })
      expectError(ctx, bad, 422, 'VALIDATION_ERROR')
      ctx.check((errorOf(bad).fields as Record<string, string>).files === 'program.exe: format atau saiz tidak dibenarkan.', 'bad file message')
    },
  },
  {
    id: 'question-sets-api/audio kbat templates: CSV and Word downloads',
    domain: 'question-sets',
    targets: ['api'],
    async run(ctx) {
      const teacher = await ctx.as('teacher')
      const csv = await teacher.request('GET', '/guru/audio-kbat/template')
      ctx.expectStatus(csv, 200)
      ctx.check(csv.headers['content-type'] === 'text/csv; charset=UTF-8', `csv content type: ${String(csv.headers['content-type'])}`)
      ctx.check(csv.headers['content-disposition'] === 'attachment; filename="template-audio-kbat.csv"', 'csv disposition')
      const word = await teacher.request('GET', '/guru/audio-kbat/template-word')
      ctx.expectStatus(word, 200)
      ctx.check(String(word.headers['content-type']).startsWith('application/vnd.openxmlformats-officedocument.wordprocessingml.document'), 'docx content type')
      ctx.check(word.headers['content-disposition'] === 'attachment; filename="template-audio-kbat.docx"', 'docx disposition')
      ctx.check(CSV.length > 0, 'csv constant')
    },
  },
  {
    id: 'question-sets-api/dskp picks: bidang, SK, SP round trip, refusals are HTTP 200 { error }',
    domain: 'question-sets',
    targets: ['api'],
    async run(ctx) {
      const teacher = await ctx.as('teacher')
      const subjectId = String(listOf(await teacher.request('GET', '/subjects'))[0]?.id)
      const cls = dataOf(await teacher.request('POST', '/guru/classes', { body: { name: 'Kelas DSKP', subjectId, educationLevel: 'tingkatan-4' } }))
      const levelId = String(cls.levelId)

      const bidang = await teacher.request('POST', '/guru/dskp/bidang', { body: { name: 'Bidang Konformans', subjectId, educationLevelId: levelId } })
      ctx.expectStatus(bidang, 201)
      const bidangId = String((bidang.body as { id?: unknown }).id)
      const sk = await teacher.request('POST', '/guru/dskp/sk', { body: { bidangId, code: '1.1', description: 'Standard kandungan' } })
      ctx.expectStatus(sk, 201)
      const skId = String((sk.body as { id?: unknown }).id)
      ctx.expectStatus(await teacher.request('POST', '/guru/dskp/sp', { body: { skId, code: '1.1.1', description: 'Standard pembelajaran' } }), 201)

      const refuse = async (path: string, body: object, message: string) => {
        const res = await teacher.request('POST', path, { body })
        ctx.expectStatus(res, 200)
        ctx.check((res.body as { error?: unknown }).error === message, `${path}: expected "${message}", got ${JSON.stringify(res.body)}`)
      }
      await refuse('/guru/dskp/bidang', { subjectId, educationLevelId: levelId }, 'Nama bidang diperlukan.')
      await refuse('/guru/dskp/bidang', { name: 'B', subjectId: '999999999', educationLevelId: levelId }, 'Subjek atau tahap tidak sah.')
      await refuse('/guru/dskp/sk', { bidangId, description: 'd' }, 'Kod dan keterangan SK diperlukan.')
      await refuse('/guru/dskp/sk', { bidangId: '999999999', code: 'c', description: 'd' }, 'Bidang tidak sah.')
      await refuse('/guru/dskp/sp', { skId, code: '' }, 'Kod dan keterangan SP diperlukan.')
      await refuse('/guru/dskp/sp', { skId: '999999999', code: 'c', description: 'd' }, 'SK tidak sah.')
    },
  },
  {
    id: 'question-sets-api/anonymous is 401, a student is 403 and a missing CSRF token is 403 on every teacher route',
    domain: 'question-sets',
    targets: ['api'],
    async run(ctx) {
      const anon = ctx.anonymous()
      const student = await ctx.as('student')
      const noCsrf = await ctx.as('teacher', { csrf: false })
      const writes: [string, object][] = [
        ['/guru/question-papers', {}],
        ['/guru/dskp/bidang', { name: 'x' }],
        ['/guru/dskp/sk', { code: 'c' }],
        ['/guru/dskp/sp', { code: 'c' }],
      ]
      const reads = ['/guru/audio-kbat/template', '/guru/audio-kbat/template-word']
      expectError(ctx, await anon.request('GET', '/set-soalan-saya'), 401, 'UNAUTHORIZED')
      for (const path of reads) {
        expectError(ctx, await anon.request('GET', path), 401, 'UNAUTHORIZED')
        expectError(ctx, await student.request('GET', path), 403, 'FORBIDDEN')
      }
      for (const [path, body] of writes) {
        expectError(ctx, await anon.request('POST', path, { body }), 401, 'UNAUTHORIZED')
        expectError(ctx, await student.request('POST', path, { body }), 403, 'FORBIDDEN')
        expectError(ctx, await noCsrf.request('POST', path, { body }), 403, 'CSRF_INVALID')
      }
    },
  },
]
