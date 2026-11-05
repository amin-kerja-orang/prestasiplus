import { Inject, Injectable } from '@nestjs/common'
import type { CommandCenterMood, CommandCenterMoodCounts, CommandCenterMoodDot } from '@pp/contract'

import { mytDay } from '../../db/clock'
import { Prisma } from '../../db/generated/client'
import { idFromString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import type { MoodReadPort, MoodWindow } from '../command-center/shared/ports'

/** The stored BM values (DM-84) as the Command Center names them. */
const PORT_MOOD: Readonly<Record<string, CommandCenterMood>> = { gembira: 'happy', okay: 'okay', sedih: 'sad', tertekan: 'stressed' }

const ids = (studentIds: string[]): bigint[] => studentIds.map(idFromString)

/** The Malaysia days a window covers (`to` is an instant: the day of the last millisecond before it, so an end at 00:00 does not add a day). */
function dayRange(window?: MoodWindow): Prisma.Sql {
  if (!window) return Prisma.empty
  const to = new Date(Math.max(window.to.getTime() - 1, window.from.getTime()))
  return Prisma.sql`AND m.checked_on >= ${mytDay(window.from)}::date AND m.checked_on <= ${mytDay(to)}::date`
}

/**
 * The real `MoodReadPort` (S5-T04, replaces the stub `NoMood`): reads `mood_checkins` for the Guru and Admin Sekolah mood panels.
 * READ ONLY. Rows written in Mod Pelajar (`is_test`) are left out everywhere. `studentIds: []` means nobody, `null` every pupil.
 */
@Injectable()
export class MoodReadAdapter implements MoodReadPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async counts(studentIds: string[] | null, window?: MoodWindow): Promise<CommandCenterMoodCounts> {
    const counts: CommandCenterMoodCounts = { happy: 0, okay: 0, sad: 0, stressed: 0 }
    if (studentIds !== null && studentIds.length === 0) return counts
    const who = studentIds === null ? Prisma.empty : Prisma.sql`AND m.user_id = ANY(${ids(studentIds)}::bigint[])`
    const rows = await this.prisma.client.$queryRaw<{ mood: string; n: bigint }[]>`
      SELECT m.mood, count(*) AS n FROM mood_checkins m WHERE m.is_test = false ${who} ${dayRange(window)} GROUP BY m.mood`
    for (const r of rows) {
      const key = PORT_MOOD[r.mood]
      if (key) counts[key] = Number(r.n)
    }
    return counts
  }

  async latest(studentIds: string[]): Promise<Map<string, CommandCenterMood>> {
    const out = new Map<string, CommandCenterMood>()
    if (studentIds.length === 0) return out
    const rows = await this.prisma.client.$queryRaw<{ user_id: bigint; mood: string }[]>`
      SELECT DISTINCT ON (m.user_id) m.user_id, m.mood FROM mood_checkins m
      WHERE m.is_test = false AND m.user_id = ANY(${ids(studentIds)}::bigint[])
      ORDER BY m.user_id, m.checked_on DESC, m.id DESC`
    for (const r of rows) {
      const mood = PORT_MOOD[r.mood]
      if (mood) out.set(r.user_id.toString(), mood)
    }
    return out
  }

  async trend(studentId: string, window: MoodWindow): Promise<CommandCenterMoodDot[]> {
    const rows = await this.prisma.client.$queryRaw<{ day: string; mood: string; reason: string | null }[]>`
      SELECT m.checked_on::text AS day, m.mood, m.reason FROM mood_checkins m
      WHERE m.is_test = false AND m.user_id = ${idFromString(studentId)}::bigint ${dayRange(window)}
      ORDER BY m.checked_on ASC, m.id ASC`
    return rows.flatMap((r) => (PORT_MOOD[r.mood] ? [{ date: r.day, mood: PORT_MOOD[r.mood]!, reason: r.reason }] : []))
  }

  async rows(studentIds: string[]): Promise<{ studentId: string; mood: CommandCenterMood; date: string; reason: string | null }[]> {
    if (studentIds.length === 0) return []
    const rows = await this.prisma.client.$queryRaw<{ user_id: bigint; day: string; mood: string; reason: string | null }[]>`
      SELECT m.user_id, m.checked_on::text AS day, m.mood, m.reason FROM mood_checkins m
      WHERE m.is_test = false AND m.user_id = ANY(${ids(studentIds)}::bigint[])
      ORDER BY m.checked_on DESC, m.id DESC`
    return rows.flatMap((r) => (PORT_MOOD[r.mood] ? [{ studentId: r.user_id.toString(), mood: PORT_MOOD[r.mood]!, date: r.day, reason: r.reason }] : []))
  }
}
