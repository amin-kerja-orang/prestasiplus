/**
 * SRS M10 v1.18 §7 #35–#38 (chapters and topics) and #42–#44 (DSKP creates); all **T**.
 * #39–#41 (`GET /api/guru/dskp/*`) are served by M04 `handlers/dskp.ts` over the M10 `dskp` store
 * (Delivery Lead decision 2026-09-30) and are **not** registered here.
 *
 * The chapter and topic lists are the M03 curriculum (D12): the teacher's inline "Bab Baru" /
 * "Topik Baru" writes go through `curriculum.createChapter` / `createTopic`. Live answers these
 * shared lookups as bare JSON: the reads give a bare array (a missing or unknown parent gives `[]`,
 * never an error) and the creates answer `201` with the new row, or `200 {error}` for a refusal
 * (FN-M10-11.1, the S18 alerts show the server `error`). Only active chapters and topics are
 * offered (INFERRED: an inactive record is hidden from the select).
 *
 * A new topic gets the next number of its chapter ("1", "2", …, as the seeded topics); a new
 * Bidang / SK / SP is stored with `createdBy` = the viewer (runtime ids from 9,000,001).
 */

import { queryInt, raw, route, type RouteDef } from '@/mock/define'
import { curriculum } from '@/modules/m03-curriculum/mock'

import { dskpRepo } from '../repository/dskp'
import { bodyOf, errorLive, intOf, MSG, teacherOnly, textOf, viewerId } from './common'

const MAX_NAME = 255

/** A required trimmed text of at most `max` characters, or `null`. */
function required(value: unknown, max = MAX_NAME): string | null {
  const t = textOf(value)
  return t !== undefined && t !== '' && [...t].length <= max ? t : null
}

export const lookupRoutes: RouteDef[] = [
  route('GET', '/api/guru/chapters', [teacherOnly], (req) => {
    const subjectId = queryInt(req.query, 'subjectId')
    const levelId = queryInt(req.query, 'educationLevelId')
    if (subjectId === undefined || levelId === undefined) return raw(200, [])
    return raw(
      200,
      curriculum
        .chapters(subjectId, levelId)
        .filter((c) => c.isActive)
        .map((c) => ({ id: c.id, chapterNumber: c.chapterNumber, name: c.name ?? '' })),
    )
  }),

  route('POST', '/api/guru/chapters', [teacherOnly], (req, ctx) => {
    const b = bodyOf(req)
    const name = required(b.name)
    if (name === null) return errorLive(MSG.chapterName)
    const number = intOf(b.chapterNumber)
    if (number === undefined || number < 1 || number > 99) return errorLive(MSG.chapterNumber)
    const subjectId = intOf(b.subjectId)
    const levelId = intOf(b.educationLevelId)
    if (
      subjectId === undefined ||
      levelId === undefined ||
      !curriculum.subject(subjectId) ||
      !curriculum.level(levelId)
    ) {
      return errorLive(MSG.chapterParent)
    }
    const row = curriculum.createChapter(
      { subjectId, educationLevelId: levelId, name, chapterNumber: number },
      ctx.clock.now(),
    )
    return raw(201, { id: row.id, chapterNumber: row.chapterNumber, name: row.name ?? name })
  }),

  route('GET', '/api/guru/topics', [teacherOnly], (req) => {
    const chapterId = queryInt(req.query, 'chapterId')
    if (chapterId === undefined || !curriculum.chapter(chapterId)) return raw(200, [])
    return raw(
      200,
      curriculum
        .topics(chapterId)
        .filter((t) => t.isActive)
        .map((t) => ({ id: t.id, topicNumber: t.topicNumber, name: t.name })),
    )
  }),

  route('POST', '/api/guru/topics', [teacherOnly], (req, ctx) => {
    const b = bodyOf(req)
    const name = required(b.name)
    if (name === null) return errorLive(MSG.topicName)
    const chapterId = intOf(b.chapterId)
    if (chapterId === undefined || !curriculum.chapter(chapterId)) {
      return errorLive(MSG.topicParent)
    }
    const next =
      Math.max(
        0,
        ...curriculum.topics(chapterId).map((t) => Number.parseInt(t.topicNumber ?? '', 10) || 0),
      ) + 1
    const row = curriculum.createTopic(
      { chapterId, name, topicNumber: String(next) },
      ctx.clock.now(),
    )
    return raw(201, { id: row.id, topicNumber: row.topicNumber, name: row.name })
  }),

  route('POST', '/api/guru/dskp/bidang', [teacherOnly], (req) => {
    const b = bodyOf(req)
    const name = required(b.name)
    if (name === null) return errorLive(MSG.bidangName)
    const subjectId = intOf(b.subjectId)
    const levelId = intOf(b.educationLevelId)
    if (
      subjectId === undefined ||
      levelId === undefined ||
      !curriculum.subject(subjectId) ||
      !curriculum.level(levelId)
    ) {
      return errorLive(MSG.bidangParent)
    }
    const codeText = textOf(b.code) ?? ''
    if ([...codeText].length > 50) return errorLive(MSG.bidangName)
    const row = dskpRepo.createBidang(
      { subjectId, educationLevelId: levelId, code: codeText === '' ? null : codeText, name },
      viewerId(req),
    )
    return raw(201, { id: row.id, code: row.code, name: row.name })
  }),

  route('POST', '/api/guru/dskp/sk', [teacherOnly], (req) => {
    const b = bodyOf(req)
    const code = required(b.code, 50)
    const description = required(b.description, 2000)
    if (code === null || description === null) return errorLive(MSG.skFields)
    const bidangId = intOf(b.bidangId)
    if (bidangId === undefined || !dskpRepo.getBidang(bidangId)) return errorLive(MSG.skParent)
    const row = dskpRepo.createSk({ bidangId, code, description }, viewerId(req))
    return raw(201, { id: row.id, code: row.code, description: row.description })
  }),

  route('POST', '/api/guru/dskp/sp', [teacherOnly], (req) => {
    const b = bodyOf(req)
    const code = required(b.code, 50)
    const description = required(b.description, 2000)
    if (code === null || description === null) return errorLive(MSG.spFields)
    const skId = intOf(b.skId)
    if (skId === undefined || !dskpRepo.getSk(skId)) return errorLive(MSG.spParent)
    const row = dskpRepo.createSp({ skId, code, description }, viewerId(req))
    return raw(201, { id: row.id, code: row.code, description: row.description })
  }),
]
