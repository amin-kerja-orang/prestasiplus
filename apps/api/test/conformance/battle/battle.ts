import { sessionLogin, type HttpClient, type HttpResponse, type Scenario, type ScenarioContext } from '@pp/contract-tests'

import { DEMO_PASSWORD, OTHER_STUDENT } from '../accounts'
import { API_ONLY, dataOf, expectError, listOf } from '../helpers'
import { battleFixture } from './fixtures'

/**
 * Battle conformance (BE-44, M16): all 25 routes of the queue, invitations, forfeit, lobby, arena, standings, history,
 * school page and tournaments, against the demo students (pelajar, pelajar2) and the admin. The shared smoke scenarios
 * prove one read per tag; these walk the real flows (a queue matched by a bot and played to question 10, a human
 * challenger, invitations, forfeit) and the documented errors, including the raw `{error}` and empty `{}` bodies.
 * Every response is also checked against the contract by the runner. API target only (they need the seeded questions
 * added by `fixtures.ts`).
 */

type Json = Record<string, unknown>
const body = (res: HttpResponse): Json => (res.body !== null && typeof res.body === 'object' ? (res.body as Json) : {})
const START = (over: Json = {}): Json => ({ question_type: 'biasa', subject_id: battleFixture.mathId, ...over })

async function secondStudent(ctx: ScenarioContext) {
  return sessionLogin(ctx.anonymous(), { identifier: OTHER_STUDENT, password: DEMO_PASSWORD })
}

async function startQueue(ctx: ScenarioContext, who: HttpClient, path = '/battle/quick-match'): Promise<string> {
  const res = await who.request('POST', path, { body: START() })
  ctx.expectStatus(res, 200)
  return String(body(res).queue_id)
}

/** Polls three times; the third poll matches a bot. Returns the battle uuid. */
async function matchBot(ctx: ScenarioContext, who: HttpClient, queueId: string): Promise<string> {
  let last: HttpResponse | null = null
  for (let i = 0; i < 3; i++) last = await who.request('GET', `/battle/poll-match/${queueId}`)
  ctx.expectStatus(last as HttpResponse, 200)
  ctx.check(body(last as HttpResponse).status === 'matched', `the third poll must match a bot, got ${JSON.stringify(body(last as HttpResponse))}`)
  return String(body(last as HttpResponse).battle_uuid)
}

/** Plays the 10 questions (always option 1, the key of every fixture question) and returns the last answer response. */
async function playToEnd(ctx: ScenarioContext, who: HttpClient, uuid: string): Promise<HttpResponse> {
  const view = await who.request('GET', `/battle/arena/${uuid}`)
  ctx.expectStatus(view, 200)
  let question = dataOf(view).question as { id: string } | null
  let last: HttpResponse = view
  for (let n = 0; n < 10 && question; n++) {
    last = await who.request('POST', `/battle/arena/${uuid}/answer`, { body: { questionId: question.id, optionId: 1, seconds: 3 } })
    ctx.expectStatus(last, 200)
    question = (dataOf(last).next as { id: string } | undefined) ?? null
  }
  return last
}

export const battleScenarios: Scenario[] = [
  {
    id: 'battle-api/quick-match: queue, three polls match a bot, the arena is played to question 10 and the battle shows in history and standings',
    domain: 'battle',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      const lobby = await student.request('GET', '/battle/lobby')
      ctx.expectStatus(lobby, 200)
      const l = dataOf(lobby)
      ctx.check(l.spmUnlocked === true && Array.isArray(l.spmSubjects) && l.gradeLabel === 'Tingkatan 4', 'the grade 10 student must have SPM unlocked and the label Tingkatan 4')
      ctx.check((l.subjects as Json[]).some((s) => s.id === battleFixture.mathId), 'the lobby must list the battle subject')

      const queueId = await startQueue(ctx, student)
      for (let i = 0; i < 2; i++) {
        const w = await student.request('GET', `/battle/poll-match/${queueId}`)
        ctx.expectStatus(w, 200)
        ctx.check(body(w).status === 'waiting', 'the first two polls must answer waiting')
      }
      const m = await student.request('GET', `/battle/poll-match/${queueId}`)
      ctx.expectStatus(m, 200)
      ctx.check(body(m).status === 'matched', 'the third poll must match')
      const uuid = String(body(m).battle_uuid)

      const view = await student.request('GET', `/battle/arena/${uuid}`)
      ctx.expectStatus(view, 200)
      const v = dataOf(view)
      const question = v.question as { id: string; options: Json[] }
      ctx.check(v.status === 'active' && v.you === 'A' && v.index === 1 && v.secondsLeft === 15, 'a new battle is active, you are A, question 1, 15 seconds')
      ctx.check(!JSON.stringify(question).includes('correct'), 'the arena question must carry no answer key')

      // Errors of the answer route.
      const bad = await student.request('POST', `/battle/arena/${uuid}/answer`, { body: { questionId: '999999999', optionId: 1, seconds: 3 } })
      expectError(ctx, bad, 422, 'VALIDATION_ERROR')
      const badOption = await student.request('POST', `/battle/arena/${uuid}/answer`, { body: { questionId: question.id, optionId: 9, seconds: 3 } })
      expectError(ctx, badOption, 422, 'VALIDATION_ERROR')
      const badTime = await student.request('POST', `/battle/arena/${uuid}/answer`, { body: { questionId: question.id, optionId: 1, seconds: 99 } })
      expectError(ctx, badTime, 422, 'VALIDATION_ERROR')

      const first = await student.request('POST', `/battle/arena/${uuid}/answer`, { body: { questionId: question.id, optionId: 1, seconds: 0 } })
      ctx.expectStatus(first, 200)
      ctx.check(dataOf(first).correct === true && dataOf(first).correctOptionId === 1 && dataOf(first).points === 1000, 'a correct answer at 0 s scores 1000')
      const end = await playToEnd(ctx, student, uuid)
      const result = dataOf(end).result as { winner: string | null; scoreA: number } | undefined
      ctx.check(result !== undefined && result.scoreA > 0, 'question 10 must return a result with the caller score')

      const done = await student.request('GET', `/battle/arena/${uuid}`)
      ctx.expectStatus(done, 200)
      ctx.check(dataOf(done).status === 'finished' && dataOf(done).question === null && dataOf(done).secondsLeft === 0, 'a finished battle has no question and secondsLeft 0')
      expectError(ctx, await student.request('POST', `/battle/arena/${uuid}/answer`, { body: { questionId: question.id, optionId: 1, seconds: 1 } }), 409, 'CONFLICT')
      const forfeit = await student.request('POST', `/battle/forfeit/${uuid}`)
      ctx.expectStatus(forfeit, 409)
      ctx.check(body(forfeit).error === 'Battle sudah tamat.', 'forfeit of a finished battle must answer {error:"Battle sudah tamat."}')

      const history = await student.request('GET', '/battle/history')
      ctx.expectStatus(history, 200)
      ctx.check(listOf(history).some((r) => r.uuid === uuid), 'the finished battle must be in the history')
      const standings = await student.request('GET', '/battle/standings/students?period=monthly')
      ctx.expectStatus(standings, 200)
      ctx.check(listOf(standings).length > 0, 'a finished battle must put a student in the monthly standings')
      ctx.expectStatus(await student.request('GET', '/battle/standings/students'), 200)
    },
  },
  {
    id: 'battle-api/school-battle and forfeit: forfeiting an active battle ends it, a second forfeit and a foreign battle are refused',
    domain: 'battle',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      const other = await secondStudent(ctx)
      const uuid = await matchBot(ctx, student, await startQueue(ctx, student, '/battle/school-battle'))

      const foreign = await other.request('POST', `/battle/forfeit/${uuid}`)
      ctx.expectStatus(foreign, 404)
      ctx.check(body(foreign).error === 'Battle tidak dijumpai.', 'a foreign battle must answer {error:"Battle tidak dijumpai."}')
      expectError(ctx, await other.request('GET', `/battle/arena/${uuid}`), 404, 'NOT_FOUND')
      expectError(ctx, await other.request('POST', `/battle/arena/${uuid}/answer`, { body: { questionId: '1', optionId: 1, seconds: 1 } }), 404, 'NOT_FOUND')

      ctx.expectStatus(await student.request('POST', `/battle/forfeit/${uuid}`), 200)
      const again = await student.request('POST', `/battle/forfeit/${uuid}`)
      ctx.expectStatus(again, 409)
      ctx.check(body(again).error === 'Battle sudah tamat.', 'a second forfeit must answer {error:"Battle sudah tamat."}')
      const unknown = await student.request('POST', '/battle/forfeit/00000000-0000-4000-8000-0000000000ff')
      ctx.expectStatus(unknown, 404)
      const view = await student.request('GET', `/battle/arena/${uuid}`)
      ctx.check(dataOf(view).status === 'forfeited', 'the arena must show the forfeited status')
    },
  },
  {
    id: 'battle-api/human challenger: join-queue, incoming challenge, accept creates one battle for both, reject returns the queue to waiting',
    domain: 'battle',
    targets: API_ONLY,
    async run(ctx) {
      const owner = await ctx.as('student')
      const joiner = await secondStudent(ctx)

      const queueId = await startQueue(ctx, owner)
      const own = await owner.request('POST', `/battle/join-queue/${queueId}`)
      ctx.expectStatus(own, 404)
      ctx.check(body(own).error === 'Ralat menghantar permohonan.', 'joining your own queue must answer {error:"Ralat menghantar permohonan."}')
      ctx.expectStatus(await joiner.request('POST', `/battle/join-queue/${queueId}`), 200)
      ctx.expectStatus(await joiner.request('POST', `/battle/join-queue/${queueId}`), 404)

      const incoming = await owner.request('GET', `/battle/poll-match/${queueId}`)
      ctx.expectStatus(incoming, 200)
      const challenger = body(incoming).challenger as Json | undefined
      ctx.check(body(incoming).status === 'incoming_challenge' && !!challenger && !('id' in challenger), 'the owner must see an incoming challenge without a challenger id')
      ctx.check((await joiner.request('GET', `/battle/poll-challenger/${queueId}`)).status === 200, 'the joiner polls the decision')

      // Reject: the queue returns to waiting and the joiner sees rejected.
      ctx.expectStatus(await owner.request('POST', `/battle/reject-challenger/${queueId}`), 200)
      const afterReject = await joiner.request('GET', `/battle/poll-challenger/${queueId}`)
      ctx.check(body(afterReject).status === 'rejected', `the joiner must see rejected, got ${JSON.stringify(body(afterReject))}`)
      ctx.expectStatus(await owner.request('POST', `/battle/reject-challenger/${queueId}`), 200) // a no-op also answers success

      // Accept: ask again, then accept; both sides get the same battle.
      ctx.expectStatus(await joiner.request('POST', `/battle/join-queue/${queueId}`), 200)
      ctx.check(body(await owner.request('GET', `/battle/poll-match/${queueId}`)).status === 'incoming_challenge', 'the second request must be incoming')
      const accepted = await owner.request('POST', `/battle/accept-challenger/${queueId}`)
      ctx.expectStatus(accepted, 200)
      const uuid = String(body(accepted).battle_uuid)
      ctx.check(body(accepted).matched === true && uuid !== 'undefined', 'accept must answer {matched:true, battle_uuid}')
      const joinerPoll = await joiner.request('GET', `/battle/poll-challenger/${queueId}`)
      ctx.check(body(joinerPoll).status === 'matched' && body(joinerPoll).battle_uuid === uuid, 'the joiner must be matched into the same battle')
      const view = await joiner.request('GET', `/battle/arena/${uuid}`)
      ctx.expectStatus(view, 200)
      ctx.check(dataOf(view).you === 'B', 'the joiner plays side B')

      // Not-found answers: a foreign or unknown queue, and a queue that is not incoming.
      const stranger = await owner.request('POST', `/battle/accept-challenger/${queueId}`)
      ctx.expectStatus(stranger, 404)
      ctx.check(body(stranger).error === 'Giliran tidak dijumpai.', 'accept of a queue that is not incoming must answer {error:"Giliran tidak dijumpai."}')
      const rejectForeign = await joiner.request('POST', `/battle/reject-challenger/${queueId}`)
      ctx.expectStatus(rejectForeign, 404)
      ctx.check(body(rejectForeign).error === 'Giliran tidak dijumpai.', 'reject by a non-owner must answer {error:"Giliran tidak dijumpai."}')
      const foreignPoll = await joiner.request('GET', `/battle/poll-match/${queueId}`)
      ctx.check(foreignPoll.status === 200 && body(foreignPoll).status === 'not_found', 'polling another user queue answers 200 {status:"not_found"}')
      const foreignChallengerPoll = await owner.request('GET', `/battle/poll-challenger/${queueId}`)
      ctx.check(foreignChallengerPoll.status === 200 && body(foreignChallengerPoll).status === 'not_found', 'poll-challenger by a non-joiner answers 200 {status:"not_found"}')

      // Clean up the open battles so they do not stay active.
      await owner.request('POST', `/battle/forfeit/${uuid}`)
    },
  },
  {
    id: 'battle-api/invitations: search, invite, list, decline, accept creates an active challenge battle, and the 422 / 404 errors',
    domain: 'battle',
    targets: API_ONLY,
    async run(ctx) {
      const sender = await ctx.as('student')
      const receiver = await secondStudent(ctx)

      const short = await sender.request('GET', '/battle/search-opponent?q=a')
      ctx.expectStatus(short, 200)
      ctx.check(Array.isArray(body(short).users) && (body(short).users as unknown[]).length === 0, 'a query under 2 characters answers {users: []}')
      const found = await sender.request('GET', '/battle/search-opponent?q=KOSONG')
      ctx.expectStatus(found, 200)
      const users = (body(found).users ?? []) as Json[]
      ctx.check(users.length === 1 && Object.keys(users[0] as Json).sort().join() === 'avatar,id,name,school', 'search is case-insensitive and hits expose id, name, school and avatar only')
      const target = String(users[0]?.id)

      const unknownReceiver = await sender.request('POST', '/battle/invite', { body: START({ receiver_id: '999999999' }) })
      ctx.expectStatus(unknownReceiver, 422)
      ctx.check(body(unknownReceiver).error === 'Penerima tidak sah.', 'an unknown receiver must answer {error:"Penerima tidak sah."}')
      const badType = await sender.request('POST', '/battle/invite', { body: START({ receiver_id: target, question_type: 'hard' }) })
      ctx.expectStatus(badType, 422)
      ctx.check(typeof body(badType).error === 'string', 'an invalid question_type answers a raw {error}')

      ctx.expectStatus(await sender.request('POST', '/battle/invite', { body: START({ receiver_id: target }) }), 200)
      const list = await receiver.request('GET', '/battle/invitations')
      ctx.expectStatus(list, 200)
      const pending = (body(list).invitations ?? []) as Json[]
      ctx.check(pending.length === 1 && Object.keys(pending[0] as Json).sort().join() === 'sender_name,sender_school,uuid', 'the receiver sees one pending invitation with name and school only')
      const first = String(pending[0]?.uuid)

      const senderAccept = await sender.request('POST', `/battle/invite/${first}/accept`)
      ctx.expectStatus(senderAccept, 404)
      ctx.check(body(senderAccept).error === 'Cabaran tidak dijumpai.', 'only the receiver can accept: {error:"Cabaran tidak dijumpai."}')
      ctx.expectStatus(await receiver.request('POST', `/battle/invite/${first}/decline`), 200)
      const declinedAgain = await receiver.request('POST', `/battle/invite/${first}/decline`)
      ctx.expectStatus(declinedAgain, 404)
      ctx.check(body(declinedAgain).error === 'Cabaran tidak dijumpai.', 'a declined invitation answers {error:"Cabaran tidak dijumpai."}')

      // A second invitation to the same receiver, accepted.
      ctx.expectStatus(await sender.request('POST', '/battle/invite', { body: START({ receiver_id: target }) }), 200)
      const next = ((body(await receiver.request('GET', '/battle/invitations')).invitations ?? []) as Json[])[0]
      const accepted = await receiver.request('POST', `/battle/invite/${String(next?.uuid)}/accept`)
      ctx.expectStatus(accepted, 200)
      const uuid = String(body(accepted).battle_uuid)
      ctx.check(body(accepted).success === true && uuid !== 'undefined', 'accept answers {success:true, battle_uuid}')
      const view = await receiver.request('GET', `/battle/arena/${uuid}`)
      ctx.expectStatus(view, 200)
      ctx.check(dataOf(view).you === 'B', 'the receiver plays side B')
      ctx.expectStatus(await receiver.request('POST', `/battle/forfeit/${uuid}`), 200)
      const unknown = await receiver.request('POST', '/battle/invite/00000000-0000-4000-8000-0000000000ee/decline')
      ctx.expectStatus(unknown, 404)
    },
  },
  {
    id: 'battle-api/start errors: an empty {} body on 422, raw {error} bodies, 401 anonymous and 403 CSRF_INVALID on every write',
    domain: 'battle',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      for (const path of ['/battle/quick-match', '/battle/school-battle']) {
        const none = await student.request('POST', path, { body: {} })
        ctx.expectStatus(none, 422)
        ctx.check(JSON.stringify(none.body) === '{}', `${path}: 422 must carry an empty body {}`)
        const unknownSubject = await student.request('POST', path, { body: START({ subject_id: '999999999' }) })
        ctx.expectStatus(unknownSubject, 422)
        ctx.check(JSON.stringify(unknownSubject.body) === '{}', `${path}: an unknown subject must carry an empty body {}`)
        const pksk = await student.request('POST', path, { body: { question_type: 'pksk', pksk_domain_id: '1', pksk_target_level: 'T1' } })
        ctx.expectStatus(pksk, 422)
      }
      const noPool = await student.request('POST', '/battle/quick-match', { body: START({ question_type: 'spm' }) })
      ctx.expectStatus(noPool, 422) // no SPM-tagged question exists in the conformance seed

      const unknownQueue = await student.request('GET', '/battle/poll-match/999999999')
      ctx.check(unknownQueue.status === 200 && body(unknownQueue).status === 'not_found', 'an unknown queue answers 200 {status:"not_found"}')
      const unknownAccept = await student.request('POST', '/battle/accept-challenger/999999999')
      ctx.expectStatus(unknownAccept, 404)
      ctx.check(body(unknownAccept).error === 'Giliran tidak dijumpai.', 'accept of an unknown queue answers {error:"Giliran tidak dijumpai."}')
      ctx.expectStatus(await student.request('POST', '/battle/reject-challenger/999999999'), 404)
      ctx.expectStatus(await student.request('POST', '/battle/join-queue/999999999'), 404)
      const pollJoiner = await student.request('GET', '/battle/poll-challenger/999999999')
      ctx.check(pollJoiner.status === 200 && body(pollJoiner).status === 'not_found', 'poll-challenger of an unknown queue answers 200 {status:"not_found"}')

      // CSRF_INVALID (403) on every write route.
      const noCsrf = await ctx.as('student', { csrf: false })
      const queueId = await startQueue(ctx, student)
      const writes: [string, Json | undefined][] = [
        ['/battle/quick-match', START()],
        ['/battle/school-battle', START()],
        [`/battle/accept-challenger/${queueId}`, undefined],
        [`/battle/reject-challenger/${queueId}`, undefined],
        [`/battle/join-queue/${queueId}`, undefined],
        ['/battle/invite', START({ receiver_id: '2' })],
        ['/battle/invite/00000000-0000-4000-8000-0000000000ee/accept', undefined],
        ['/battle/invite/00000000-0000-4000-8000-0000000000ee/decline', undefined],
        ['/battle/forfeit/00000000-0000-4000-8000-0000000000ee', undefined],
        ['/battle/arena/00000000-0000-4000-8000-0000000000ee/answer', { questionId: '1', optionId: 1, seconds: 1 }],
      ]
      for (const [path, payload] of writes) {
        expectError(ctx, await noCsrf.request('POST', path, payload ? { body: payload } : {}), 403, 'CSRF_INVALID')
      }

      // 401 on every battle route.
      const anon = ctx.anonymous()
      const reads = ['/battle/poll-match/1', '/battle/poll-challenger/1', '/battle/search-opponent?q=ab', '/battle/invitations', '/battle/lobby', '/battle/arena/00000000-0000-4000-8000-0000000000ee', '/battle/standings/students', '/battle/standings/schools', '/battle/schools/1', '/battle/history', '/tournament/active', '/tournaments', '/tournaments/form-options', '/tournaments/00000000-0000-4000-8000-0000000000ee']
      for (const path of reads) expectError(ctx, await anon.request('GET', path), 401, 'UNAUTHORIZED')
      for (const [path, payload] of writes) expectError(ctx, await anon.request('POST', path, payload ? { body: payload } : {}), 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('POST', '/tournaments', { body: {} }), 401, 'UNAUTHORIZED')
    },
  },
  {
    id: 'battle-api/school standings, podium and school page agree after a finished battle; unknown school is 404',
    domain: 'battle',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      const uuid = await matchBot(ctx, student, await startQueue(ctx, student))
      await playToEnd(ctx, student, uuid)

      const schools = await student.request('GET', '/battle/standings/schools')
      ctx.expectStatus(schools, 200)
      const rows = (dataOf(schools).rows ?? []) as Json[]
      ctx.check(dataOf(schools).activePeriod === 'weekly' && rows.length > 0, 'the default period is weekly and has a ranked school')
      ctx.check(((dataOf(schools).podium ?? []) as Json[]).length > 0, 'the podium lists the top schools')
      const monthly = await student.request('GET', '/battle/standings/schools?period=monthly')
      ctx.check(dataOf(monthly).activePeriod === 'monthly', 'period=monthly echoes monthly')
      const unknownPeriod = await student.request('GET', '/battle/standings/schools?period=nonsense')
      ctx.check(dataOf(unknownPeriod).activePeriod === null, 'an unknown period is all time with activePeriod null')
      const byState = await student.request('GET', `/battle/standings/schools?state=${encodeURIComponent(String(rows[0]?.state))}`)
      ctx.expectStatus(byState, 200)
      const none = await student.request('GET', '/battle/standings/schools?state=Tiada')
      ctx.check(((dataOf(none).rows ?? []) as Json[]).length === 0, 'an unknown state filters every row out')

      const schoolId = String(rows[0]?.schoolId)
      const page = await student.request('GET', `/battle/schools/${schoolId}`)
      ctx.expectStatus(page, 200)
      ctx.check(String((dataOf(page).school as Json).id) === schoolId, 'the school page is the school asked for')
      expectError(ctx, await student.request('GET', '/battle/schools/999999999'), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'battle-api/tournaments: admin form options and create (draft, registration), the 422 fields, active list, detail and draft visibility',
    domain: 'battle',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const student = await ctx.as('student')

      const options = await admin.request('GET', '/tournaments/form-options')
      ctx.expectStatus(options, 200)
      const o = dataOf(options)
      ctx.check((o.educationLevels as Json[]).length === 3 && (o.examPapers as unknown[]).length === 0, 'three education levels and no exam papers')
      const subjectId = String(((o.subjects as Json[]).find((s) => s.code === 'MATH') ?? (o.subjects as Json[])[0])?.id)
      expectError(ctx, await student.request('GET', '/tournaments/form-options'), 403, 'FORBIDDEN')

      const valid: Json = {
        title: 'Kejohanan Conformance',
        education_level_id: 'tingkatan4',
        format: 'single_match',
        question_mode: 'subject',
        subject_id: subjectId,
        total_questions: 10,
        time_window_minutes: 30,
        top_n_scoring: 5,
        min_participants: 2,
        registration_opens_at: '2026-10-01T08:00',
        registration_closes_at: '2026-12-01T08:00',
        action: 'draft',
      }
      const draft = await admin.request('POST', '/tournaments', { body: valid })
      ctx.expectStatus(draft, 201)
      ctx.check(dataOf(draft).status === 'draft', 'action draft creates a draft')
      const open = await admin.request('POST', '/tournaments', { body: { ...valid, title: 'Kejohanan Terbuka Conformance', action: 'open_registration' } })
      ctx.expectStatus(open, 201)
      ctx.check(dataOf(open).status === 'registration', 'action open_registration creates a registration tournament')
      const draftId = String(dataOf(draft).uuid)
      const openId = String(dataOf(open).uuid)

      const invalid = await admin.request('POST', '/tournaments', { body: { ...valid, title: '', question_mode: 'exam_paper', total_questions: 2, registration_closes_at: '2026-09-01T08:00' } })
      expectError(ctx, invalid, 422, 'VALIDATION_ERROR')
      const fields = ((body(invalid).error as Json).fields ?? {}) as Json
      ctx.check('title' in fields && 'total_questions' in fields && 'exam_paper_id' in fields, `422 must list every failing field, got ${JSON.stringify(fields)}`)
      expectError(ctx, await student.request('POST', '/tournaments', { body: valid }), 403, 'FORBIDDEN')

      const active = await student.request('GET', '/tournament/active')
      ctx.expectStatus(active, 200)
      const ids = (active.body as Json[]).map((t) => t.uuid)
      ctx.check(Array.isArray(active.body) && ids.includes(openId) && !ids.includes(draftId), 'the banner is a bare array with the open tournament and without the draft')
      const list = await student.request('GET', '/tournaments')
      ctx.expectStatus(list, 200)
      ctx.check(listOf(list).some((t) => t.uuid === openId) && !listOf(list).some((t) => t.uuid === draftId), 'the list has the open tournament and no draft')

      ctx.expectStatus(await student.request('GET', `/tournaments/${openId}`), 200)
      expectError(ctx, await student.request('GET', `/tournaments/${draftId}`), 404, 'NOT_FOUND')
      const asAdmin = await admin.request('GET', `/tournaments/${draftId}`)
      ctx.expectStatus(asAdmin, 200)
      ctx.check(dataOf(asAdmin).status === 'draft' && dataOf(asAdmin).examPaperId === null && dataOf(asAdmin).liveMatch === null, 'the admin reads the draft, examPaperId and liveMatch are null')
      expectError(ctx, await student.request('GET', '/tournaments/00000000-0000-4000-8000-0000000000ee'), 404, 'NOT_FOUND')
    },
  },
]
