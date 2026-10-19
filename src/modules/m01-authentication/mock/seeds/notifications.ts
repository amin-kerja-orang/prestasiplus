/**
 * Notification seeds (SRS M01 v1.12 §6.8 "Notifications" column and "Notification templates").
 *
 * | id | user | total | unread | categories |
 * |---|---|---|---|---|
 * | 1 | admin | 167 | 166 | none (null), types `chatbot_new_conversation`, `new_ticket`, `spaced_review` |
 * | 2 | pelajar | 45 | 12 | system / reminder / milestone |
 * | 3 | pelajar2 | 3 | 0 | mixed |
 * | 4 | pelajarmaju | 5 | 2 | mixed |
 * | 5 | guru | 5 | 2 (INFERRED: the SRS gives no unread figure) | mixed |
 * | 6 | ibubapa | 0 | 0 | empty inbox |
 * | 7–10 | penaja, adminsekolah, ppd, jpn | 1 | 1 (INFERRED) | system |
 * | 11 | tidakaktif | 0 | 0 | — |
 *
 * `createdAt` values are spread over 90 days back from the mock anchor (2026-09-25 15:40), strictly
 * decreasing per user, computed (no PRNG) so the seed never changes. Ids are fixed and increase with
 * recency; the admin's newest is 180915 (the live id shown in DATA-M01-04), the rest follow.
 *
 * INFERRED copy (the SRS gives only the three templates): the `system_announcement` and
 * `achievement_unlocked` texts, the `new_ticket` body, the substitution values.
 */

import { CLOCK_ANCHOR_MS, toIsoMyt } from '@/lib/time'

import type { NotificationCategory } from '../../api/notifications'
import { notificationsRepo, type NotificationRow } from '../handlers/notifications-store'

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE
export const SEED_SPAN_MS = 90 * DAY
/** The admin's newest notification id (live example, DATA-M01-04). */
export const ADMIN_NEWEST_ID = 180915

interface Plan {
  userId: number
  name: string
  total: number
  /** Positions (0 = newest) that are unread; everything else is read. */
  unread: (k: number) => boolean
  kinds: (k: number) => Kind
}

type Kind = 'chatbot' | 'ticket' | 'review' | 'system' | 'milestone'

const PATHS = ['/dashboard', '/practice', '/prestasi', '/profile', '/notifikasi']
const SUBJECTS = ['Matematik', 'Sains', 'Bahasa Melayu', 'Sejarah', 'Bahasa Inggeris']
const ASKERS = ['Pelajar Demo', 'Pelajar Dua Demo', 'Pelajar Maju Demo']

interface Rendered {
  type: string
  category: NotificationCategory | null
  title: string
  body: string
}

function render(kind: Kind, name: string, k: number, useCategory: boolean): Rendered {
  const subject = SUBJECTS[k % SUBJECTS.length]!
  switch (kind) {
    case 'chatbot':
      return {
        type: 'chatbot_new_conversation',
        category: null,
        title: 'Chatbot: Perbualan Baru',
        body: `${ASKERS[k % ASKERS.length]!} memulakan perbualan dari ${PATHS[k % PATHS.length]!}`,
      }
    case 'ticket':
      return {
        type: 'new_ticket',
        category: null,
        title: 'Tiket baru',
        body: 'Tiket sokongan baharu telah diterima.',
      }
    case 'review':
      return {
        type: 'spaced_review',
        category: useCategory ? 'reminder' : null,
        title: `📚 Nota menunggu kamu, ${name}`,
        body: `Hai ${name}! Cikgu Alesa ada 9 nota ringkas tunggu kamu ulangkaji (${subject}). Klik buka — 5 minit sahaja.`,
      }
    case 'system':
      return {
        type: 'system_announcement',
        category: 'system',
        title: 'Pengumuman Sistem',
        body: 'Selamat datang ke PretasiPlus! Semak ciri baharu di papan pemuka anda.',
      }
    case 'milestone':
      return {
        type: 'achievement_unlocked',
        category: 'milestone',
        title: 'Pencapaian baharu!',
        body: `Tahniah ${name}, kamu telah mencapai satu lagi pencapaian dalam ${subject}.`,
      }
  }
}

/** Repeating category rhythm of the pelajar (45 items: reminders dominate, all 3 categories). */
const MIXED: readonly Kind[] = [
  'review',
  'milestone',
  'review',
  'system',
  'review',
  'milestone',
  'review',
  'system',
  'milestone',
]
const mixed = (k: number): Kind => MIXED[k % MIXED.length]!

const PELAJAR_UNREAD = new Set([0, 1, 2, 4, 5, 7, 9, 11, 14, 17, 20, 24])

/** Admin rhythm: mostly chatbot conversations, with reviews and tickets mixed in. */
function adminKind(k: number): Kind {
  if (k % 10 === 4) return 'ticket'
  if (k % 5 === 2) return 'review'
  return 'chatbot'
}

const PLANS: readonly Plan[] = [
  {
    userId: 1,
    name: 'Admin Demo',
    total: 167,
    unread: (k) => k !== 166, // only the oldest is read
    kinds: adminKind,
  },
  {
    userId: 2,
    name: 'Pelajar Demo',
    total: 45,
    unread: (k) => PELAJAR_UNREAD.has(k),
    kinds: mixed,
  },
  { userId: 3, name: 'Pelajar Dua Demo', total: 3, unread: () => false, kinds: mixed },
  {
    userId: 4,
    name: 'Pelajar Maju Demo',
    total: 5,
    unread: (k) => k < 2,
    kinds: mixed,
  },
  { userId: 5, name: 'Guru Demo', total: 5, unread: (k) => k < 2, kinds: mixed },
  { userId: 7, name: 'Penaja Demo', total: 1, unread: () => true, kinds: () => 'system' },
  {
    userId: 8,
    name: 'Pentadbir Sekolah Demo',
    total: 1,
    unread: () => true,
    kinds: () => 'system',
  },
  { userId: 9, name: 'Pegawai PPD Demo', total: 1, unread: () => true, kinds: () => 'system' },
  { userId: 10, name: 'Pegawai JPN Demo', total: 1, unread: () => true, kinds: () => 'system' },
]

/** The seeded rows of every account (ids ascending: oldest first per user). */
export function buildNotificationSeed(): NotificationRow[] {
  const rows: NotificationRow[] = []
  let nextId = ADMIN_NEWEST_ID - PLANS[0]!.total + 1 // admin ends at ADMIN_NEWEST_ID
  for (const plan of PLANS) {
    const perUser: NotificationRow[] = []
    for (let k = 0; k < plan.total; k++) {
      // k = 0 is the newest. Steps are far larger than the 0–52 min jitter, so times strictly decrease.
      const age =
        60 * MINUTE + Math.floor((k * SEED_SPAN_MS) / plan.total) + ((k * 37) % 53) * MINUTE
      const createdMs = CLOCK_ANCHOR_MS - age
      const kind = plan.kinds(k)
      // Only the admin's items have no category at all (`spaced_review` included).
      const text = render(kind, plan.name, k, plan.userId !== 1)
      const unread = plan.unread(k)
      perUser.push({
        id: 0,
        userId: plan.userId,
        ...text,
        readAt: unread ? null : toIsoMyt(Math.min(createdMs + 3 * 60 * MINUTE, CLOCK_ANCHOR_MS)),
        createdAt: toIsoMyt(createdMs),
      })
    }
    // Ids increase with recency: the oldest (last k) gets the smallest id.
    perUser.reverse()
    for (const row of perUser) rows.push({ ...row, id: nextId++ })
  }
  return rows
}

/** Seed phase: writes the notifications through the owner repository. */
export function seedNotifications(): void {
  notificationsRepo.seedRows(buildNotificationSeed())
}
