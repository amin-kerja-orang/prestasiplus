/**
 * SRS M08 v1.11 §7 #18 timeline, #19 create post, #20 public profile (G, no session), #21 rankings,
 * #22 leaderboard, #23 weekly report (403: the admin as observed; every other role BLOCKED, OQ-M08-01,
 * so the same 403 page is reused, provisional).
 */

import {
  created,
  forbidden,
  int,
  notFound,
  ok,
  queryString,
  requireAuth,
  route,
  validationError,
  type RouteDef,
} from '@/mock/define'
import { formatDateKey, toIsoMyt } from '@/lib/time'
import { users } from '@/modules/m01-authentication/mock'
import { schools } from '@/modules/m02-users-schools/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { practice } from '@/modules/m05-practice/mock'
import { achievements, streak, tiers, wallet } from '@/modules/m14-gamification/mock'

import type {
  PublicProfile,
  Timeline,
  TimelineCategory,
  TimelineEntry,
  TimelinePost,
} from '../../api/types'
import { PRACTICE_MODE_SET } from '../repository/reads'
import { capPercent, pct, round } from '../repository/rules'
import { PERIODS, kedudukanOf, leaderboardOf } from '../repository/social'
import { activityRepo, timelineRepo } from '../repository/stores'
import type { TimelinePostRow } from '../repository/types'
import { viewerOf } from './common'

const CATEGORIES: readonly TimelineCategory[] = [
  'sijil',
  'pencapaian',
  'aktiviti',
  'cerita',
  'lain',
]
const MAX_PHOTO_BYTES = 2 * 1024 * 1024
const PHOTO_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp']

/** S18 "Tahap" (INFERRED): the 1-based position of the tier among the active tiers by `minSyiling`. */
export function tierOrdinal(key: string): number {
  const ordered = tiers
    .list()
    .filter((t) => t.isActive)
    .sort((a, b) => a.minSyiling - b.minSyiling)
  return Math.max(1, ordered.findIndex((t) => t.tierName === key) + 1)
}

const postView = (p: TimelinePostRow): TimelinePost => ({
  ...p,
  photos: p.photos.map((x) => ({ ...x })),
})

/** The feed shows at most this many rows (the API caps the same way). */
const FEED_LIMIT = 100
const KIND_ORDER = { badge: 0, post: 1, session: 2 } as const

/**
 * The viewer's own feed (R1-MUR-39): finished practice sessions (the M05 history, practice modes only, read the same
 * way as the public profile), unlocked badges and own posts, merged newest first (ties: kind, then id).
 */
function feedOf(viewerId: number): TimelineEntry[] {
  const sessions = practice
    .history(viewerId)
    .filter((s) => PRACTICE_MODE_SET.has(s.mode) && s.total > 0 && s.completedAtMs > 0)
    .slice(0, FEED_LIMIT)
    .map((s): TimelineEntry => ({
      kind: 'session',
      id: `s:${s.id}`,
      at: toIsoMyt(s.completedAtMs),
      subjectName: s.subjectId === null ? '' : (curriculum.subject(s.subjectId)?.name ?? ''),
      correct: s.correct,
      answered: s.total,
      accuracy: Math.round((s.correct / s.total) * 100),
    }))
  const badges = achievements
    .forUser(viewerId)
    .items.filter((a) => a.unlocked && a.unlockedAt !== null)
    .map((a): TimelineEntry => ({ kind: 'badge', id: `b:${String(a.id)}`, at: toIsoMyt(a.unlockedAt as string), name: a.name, icon: a.icon }))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, FEED_LIMIT)
  const posts = timelineRepo
    .forUser(viewerId)
    .map(postView)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id)
    .slice(0, FEED_LIMIT)
    .map((post): TimelineEntry => ({ kind: 'post', id: post.id, at: toIsoMyt(post.createdAt), post }))
  return [...sessions, ...badges, ...posts]
    .sort(
      (a, b) =>
        Date.parse(b.at) - Date.parse(a.at) ||
        KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
        (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0),
    )
    .slice(0, FEED_LIMIT)
}

const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined ? [] : [v])
const isFile = (v: unknown): v is Blob => typeof Blob !== 'undefined' && v instanceof Blob

async function dataUrl(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return `data:${file.type};base64,${btoa(bin)}`
}

/** Form value under `key` or `key[]`, as a list. */
const field = (body: Record<string, unknown>, key: string): unknown[] => [
  ...asList(body[key]),
  ...asList(body[`${key}[]`]),
]

export const socialRoutes: RouteDef[] = [
  route('GET', '/api/timeline', [requireAuth()], (req) => {
    const viewer = viewerOf(req)
    // `profileUrl` is the path; the page prefixes the origin (FR-M08-98).
    const body: Timeline = {
      profileUrl: `/pelajar/${String(viewer.id)}`,
      posts: timelineRepo.forUser(viewer.id).map(postView),
      entries: feedOf(viewer.id),
    }
    return ok(body)
  }),

  route(
    'DELETE',
    '/api/timeline/:id',
    [requireAuth()],
    (req) => {
      const viewer = viewerOf(req)
      // Another user's post and an unknown id are the same answer.
      if (!timelineRepo.removeOwn(viewer.id, req.params.id as number)) return notFound()
      return ok({ deleted: 1 })
    },
    { params: { id: int() } },
  ),

  route('POST', '/api/timeline', [requireAuth()], async (req, ctx) => {
    const viewer = viewerOf(req)
    const body = (req.body ?? {}) as Record<string, unknown>
    const fields: Record<string, string> = {}
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    // INFERRED messages (the SRS gives copy only for the missing photo, PROPOSED COPY).
    if (title === '') fields.title = 'Tajuk diperlukan.'
    else if (title.length > 150) fields.title = 'Tajuk terlalu panjang (maks 150 aksara).'
    const category = body.category
    if (typeof category !== 'string' || !CATEGORIES.includes(category as TimelineCategory)) {
      fields.category = 'Kategori tidak sah.'
    }
    const eventDate =
      typeof body.eventDate === 'string' && body.eventDate !== '' ? body.eventDate : null
    if (eventDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      fields.eventDate = 'Tarikh tidak sah.'
    }
    const story = typeof body.story === 'string' && body.story !== '' ? body.story : null
    if (story !== null && story.length > 2000) {
      fields.story = 'Cerita terlalu panjang (maks 2000 aksara).'
    }
    const files = field(body, 'photos').filter(isFile)
    if (files.length < 1 || files.length > 5) {
      fields.photos = 'Sila muat naik sekurang-kurangnya 1 gambar.'
    } else if (files.some((f) => f.size > MAX_PHOTO_BYTES || !PHOTO_TYPES.includes(f.type))) {
      fields.photos = 'Gambar tidak sah (JPEG, PNG atau WebP, maks 2MB).'
    }
    if (Object.keys(fields).length > 0) return validationError(fields)

    const captions = [...asList(body.captions), ...asList(body['captions[]'])]
    for (const [k, v] of Object.entries(body)) {
      const m = /^captions\[(\d+)\]$/.exec(k)
      if (m) captions[Number(m[1])] = v
    }
    const photos = await Promise.all(
      files.map(async (f, i) => {
        const c = captions[i]
        const caption = typeof c === 'string' && c.trim() !== '' ? c.slice(0, 200) : null
        return { url: await dataUrl(f), caption }
      }),
    )
    const row = timelineRepo.create({
      userId: viewer.id,
      title,
      category: category as TimelineCategory,
      eventDate,
      story,
      photos,
      createdAt: new Date(ctx.clock.now()).toISOString(),
    })
    return created(postView(row))
  }),

  route(
    'GET',
    '/api/public/students/:id',
    [],
    (req, ctx) => {
      const user = users.get(req.params.id as number)
      if (!user) return notFound()
      const now = ctx.clock.now()
      const stats = activityRepo.get(user.id)
      const sessions = practice.history(user.id).filter((s) => PRACTICE_MODE_SET.has(s.mode))
      const correct = sessions.reduce((a, s) => a + s.correctCount, 0)
      const asked = sessions.reduce((a, s) => a + s.questionCount, 0)
      const joinedAt = stats?.joinedAt ?? user.createdAt
      const w = wallet.summary(user.id)
      const st = streak.get(user.id)
      const levelId = stats?.profileLevelId ?? user.grade
      const level = levelId === null ? undefined : curriculum.level(levelId)
      const body: PublicProfile = {
        id: user.id,
        name: user.name,
        firstName: user.name.trim().split(/\s+/)[0] ?? user.name,
        schoolName: user.schoolId === null ? null : (schools.get(user.schoolId)?.name ?? null),
        levelName: level?.name ?? '',
        joinedAt,
        daysWith: Math.floor((now - Date.parse(joinedAt)) / 86_400_000),
        tier: {
          key: w.tier.key,
          name: w.tier.labelMs,
          emoji: w.tier.icon,
          level: w.level,
          ordinal: tierOrdinal(w.tier.key),
          progressPct: w.nextTier ? w.nextTier.pct : 100,
          toNext: w.nextTier ? w.nextTier.need : null,
          nextName: w.nextTier ? w.nextTier.labelMs : null,
          nextKey: w.nextTier ? w.nextTier.key : null,
        },
        syiling: w.currentSyiling,
        streak: { current: st.current, best: st.best },
        accuracy: round(capPercent(pct(correct, asked)), 1),
        activity: {
          sessions: sessions.length,
          // INFERRED: derived from the log (S18 "0 hari berlatih"); S6 shows the stored counter.
          practiceDays: new Set(sessions.map((s) => formatDateKey(s.completedAtMs))).size,
          correct,
          bestStreak: st.best,
        },
        posts: timelineRepo.forUser(user.id).map(postView),
      }
      return ok(body)
    },
    { params: { id: int() } },
  ),

  route('GET', '/api/rankings', [requireAuth()], (req) => {
    const viewer = viewerOf(req)
    return ok(
      kedudukanOf({
        id: viewer.id,
        role: viewer.role,
        schoolId: viewer.schoolId,
        name: viewer.user.name,
      }),
    )
  }),

  route('GET', '/api/leaderboard', [requireAuth()], (req, ctx) => {
    const asked = queryString(req.query, 'period')
    // An unknown period falls back to the week (FR-M08-114).
    const period = PERIODS.find((p) => p === asked) ?? 'week'
    return ok(leaderboardOf(period, viewerOf(req).id, ctx.clock.now()))
  }),

  route('GET', '/api/weekly-report', [requireAuth()], () => forbidden()),
]
