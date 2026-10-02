/**
 * The `perutusan` repository (owner M09; SRS M09 v1.2 §6.6–§6.7, §6.11, BR-M09-22…28): posts,
 * reactions, comments and reads. Visibility, order, excerpt and reaction rules are the BR-M09 ones;
 * counts (`Q-PER-*`) are computed from the tables.
 */

import { defineNamedQueries } from '@/mock/dataset'
import { defineRepository } from '@/mock/repository'
import { schools } from '@/modules/m02-users-schools/mock'
import { users } from '@/modules/m01-authentication/mock'

import { initialsOf } from '../data/labels'
import {
  perutusanCommentsTable,
  perutusanReactionsTable,
  perutusanReadsTable,
  perutusanTable,
} from '../tables/tables'
import type {
  PerutusanCommentRow,
  PerutusanReactionRow,
  PerutusanRow,
  ReactionType,
  Viewer,
} from '../types'
import { toEpochMs, toIsoMyt } from '@/lib/time'

import { M09Error, m09Now, nowIso } from './common'

export const NATIONAL_SCOPE_LABEL = 'Seluruh Malaysia (Kebangsaan)'
export const SCHOOL_SCOPE_LABEL = 'Sekolah'
export const MAX_PINNED_PER_SCOPE = 2
export const MAX_COMMENT_LENGTH = 1000
const EXCERPT_LENGTH = 250

const REACTION_ORDER: readonly ReactionType[] = ['like', 'love', 'thanks']
const REACTION_EMOJI: Readonly<Record<ReactionType, string>> = {
  like: '👍',
  love: '❤️',
  thanks: '🙏',
}

export const perutusanQueries = defineNamedQueries(perutusanTable, {
  'Q-PER-ALL': { where: {}, expected: 3, source: 'M09 §6.11' },
  'Q-PER-PINNED': { where: { isPinned: true }, expected: 2, source: 'M09 §6.11' },
  'Q-PER-PUBLIC': { where: { isPublic: true }, expected: 1, source: 'M09 §6.11' },
})

export interface PerutusanCard {
  id: number
  title: string
  excerpt: string
  isPinned: boolean
  hasVideo: boolean
  scopeLabel: string
  createdAt: string
  author: { name: string; initials: string; roleLabel: string }
  topReaction: { type: ReactionType; emoji: string; count: number } | null
  commentCount: number
  reads: number
}

export interface PerutusanDetail extends PerutusanCard {
  body: string
  images: PerutusanRow['images']
  documents: PerutusanRow['documents']
  youtubeUrl: string | null
  isPublic: boolean
  reactions: Record<ReactionType, number>
  myReactions: ReactionType[]
  canWrite: boolean
}

export interface PerutusanInput {
  title: string
  body: string
  images?: PerutusanRow['images']
  documents?: PerutusanRow['documents']
  youtubeUrl?: string | null
  isPinned?: boolean
  isPublic?: boolean
  status: PerutusanRow['status']
  scheduledAt?: string | null
}

/** BR-M09-27: HTML removed, whitespace collapsed, cut to 250 characters + "...". */
export function excerptOf(html: string): string {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH)}...` : text
}

const isAdmin = (viewer: Viewer | null | undefined): boolean => viewer?.role === 'admin'

/** Effective publish time (epoch ms, BR-M09-24). */
const publishMs = (p: PerutusanRow): number => toEpochMs(p.scheduledAt ?? p.createdAt)

/** BR-M09-23 (list rule): published, or scheduled and due; and in scope for the viewer. */
export function perutusanVisibleTo(p: PerutusanRow, viewer: Viewer | null | undefined): boolean {
  if (!viewer) return false
  const due =
    p.status === 'published' ||
    (p.status === 'scheduled' && (p.scheduledAt === null || toEpochMs(p.scheduledAt) <= m09Now()))
  const inScope =
    p.scope === 'national' ||
    (viewer.schoolId !== null && p.schoolId === viewer.schoolId) ||
    viewer.id === p.authorId ||
    isAdmin(viewer)
  return due && inScope
}

export const perutusanRepo = defineRepository({
  owner: 'M09',
  name: 'perutusan',
  store: perutusanTable,
  stores: {
    reactions: perutusanReactionsTable,
    comments: perutusanCommentsTable,
    reads: perutusanReadsTable,
  },
  queries: perutusanQueries,
  methods: ({ store, stores, transaction }) => {
    const requirePost = (id: number): PerutusanRow => {
      const row = store.get(id)
      if (!row) throw new M09Error('NOT_FOUND', `Perutusan ${String(id)} tidak dijumpai.`)
      return row
    }

    const reactionCounts = (id: number): Record<ReactionType, number> => {
      const counts: Record<ReactionType, number> = { like: 0, love: 0, thanks: 0 }
      for (const r of stores.reactions.query({ where: { perutusanId: id } }).rows) counts[r.type]++
      return counts
    }

    const approvedComments = (id: number): PerutusanCommentRow[] =>
      stores.comments.query({ where: { perutusanId: id, status: 'approved' } }).rows

    const roleLabelOf = (role: string | undefined): string =>
      role === 'school_admin' ? 'Pengetua' : role === 'admin' ? 'Admin' : ''

    /** BR-M09-25: only the type with the highest count (ties like > love > thanks). */
    const topReactionOf = (id: number): PerutusanCard['topReaction'] => {
      const counts = reactionCounts(id)
      let best: ReactionType | null = null
      for (const type of REACTION_ORDER) {
        if (counts[type] > 0 && (best === null || counts[type] > counts[best])) best = type
      }
      return best === null ? null : { type: best, emoji: REACTION_EMOJI[best], count: counts[best] }
    }

    const scopeLabelOf = (p: PerutusanRow): string =>
      p.scope === 'national'
        ? NATIONAL_SCOPE_LABEL
        : p.schoolId !== null
          ? (schools.get(p.schoolId)?.name ?? SCHOOL_SCOPE_LABEL)
          : SCHOOL_SCOPE_LABEL

    const cardOf = (p: PerutusanRow): PerutusanCard => {
      const author = users.get(p.authorId)
      const name = author?.name ?? 'Pengguna'
      return {
        id: p.id,
        title: p.title,
        excerpt: excerptOf(p.body),
        isPinned: p.isPinned,
        hasVideo: p.youtubeUrl !== null,
        scopeLabel: scopeLabelOf(p),
        createdAt: p.createdAt,
        author: { name, initials: initialsOf(name), roleLabel: roleLabelOf(author?.role) },
        topReaction: topReactionOf(p.id),
        commentCount: approvedComments(p.id).length,
        reads: p.reads,
      }
    }

    const ordered = (rows: PerutusanRow[]): PerutusanRow[] =>
      [...rows].sort(
        (a, b) =>
          Number(b.isPinned) - Number(a.isPinned) || publishMs(b) - publishMs(a) || a.id - b.id,
      )

    return {
      /** Seed phase: posts, then the seeded reaction rows (no reads, no comments). */
      seed(
        posts: readonly PerutusanRow[],
        reactions: readonly Omit<PerutusanReactionRow, 'id'>[],
      ): void {
        transaction(() => {
          for (const p of posts) store.insert({ ...p })
          for (const r of reactions) stores.reactions.insert({ ...r })
        })
      },

      get(id: number): PerutusanRow | undefined {
        return store.get(id)
      },

      /** S22: visible posts for the viewer, pinned first then newest (BR-M09-23, BR-M09-24). */
      list(viewer: Viewer | null): PerutusanCard[] {
        return ordered(store.query().rows.filter((p) => perutusanVisibleTo(p, viewer))).map(cardOf)
      },

      /** S25: the viewer's own posts (all statuses), pinned first then newest. */
      mine(viewer: Viewer): PerutusanCard[] {
        return ordered(store.query({ where: { authorId: viewer.id } }).rows).map(cardOf)
      },

      /** S23: a visible post, or a draft for its author and the admin; `undefined` otherwise. */
      detail(id: number, viewer: Viewer | null): PerutusanDetail | undefined {
        const p = store.get(id)
        if (!p || !viewer) return undefined
        const draftOk = p.status !== 'published' && (p.authorId === viewer.id || isAdmin(viewer))
        if (!draftOk && !perutusanVisibleTo(p, viewer)) return undefined
        const mine = stores.reactions.query({ where: { perutusanId: id, userId: viewer.id } }).rows
        return {
          ...cardOf(p),
          body: p.body,
          images: p.images,
          documents: p.documents,
          youtubeUrl: p.youtubeUrl,
          isPublic: p.isPublic,
          reactions: reactionCounts(id),
          myReactions: mine.map((r) => r.type),
          canWrite: p.authorId === viewer.id || isAdmin(viewer),
        }
      },

      /** S28: a public, published post (guests included); `undefined` otherwise. */
      publicDetail(id: number): PerutusanDetail | undefined {
        const p = store.get(id)
        if (!p || !p.isPublic || p.status !== 'published') return undefined
        return {
          ...cardOf(p),
          body: p.body,
          images: p.images,
          documents: p.documents,
          youtubeUrl: p.youtubeUrl,
          isPublic: true,
          reactions: reactionCounts(id),
          myReactions: [],
          canWrite: false,
        }
      },

      /**
       * BR-M09-07: a logged-in user who is neither the admin nor the author counts once per post
       * (INFERRED, OQ-M09-06). Returns the reads after the call.
       */
      markRead(id: number, viewer: Viewer): number {
        return transaction(() => {
          const p = requirePost(id)
          if (isAdmin(viewer) || viewer.id === p.authorId) return p.reads
          const seen = stores.reads.query({ where: { perutusanId: id, userId: viewer.id } }).total
          if (seen > 0) return p.reads
          stores.reads.insert({ perutusanId: id, userId: viewer.id, readAt: nowIso() })
          return store.update(id, { reads: p.reads + 1 }).reads
        })
      },

      /** BR-M09-25: toggles the (user, post, type) reaction (handlers gate this and `addComment` with `perutusanVisibleTo` first); returns the counts and the user's types. */
      toggleReaction(
        id: number,
        viewer: Viewer,
        type: ReactionType,
      ): { reactions: Record<ReactionType, number>; myReactions: ReactionType[] } {
        return transaction(() => {
          requirePost(id)
          const existing = stores.reactions.query({
            where: { perutusanId: id, userId: viewer.id, type },
          }).rows[0]
          if (existing) stores.reactions.remove(existing.id)
          else
            stores.reactions.insert({
              perutusanId: id,
              userId: viewer.id,
              type,
              createdAt: nowIso(),
            })
          const mine = stores.reactions.query({
            where: { perutusanId: id, userId: viewer.id },
          }).rows
          return { reactions: reactionCounts(id), myReactions: mine.map((r) => r.type) }
        })
      },

      /** BR-M09-26: 1–1000 characters, stored `pending` (never shown until approved). */
      addComment(id: number, viewer: Viewer, body: string): PerutusanCommentRow {
        const text = body.trim()
        if ([...text].length < 1 || [...text].length > MAX_COMMENT_LENGTH) {
          throw new M09Error('VALIDATION_ERROR', 'Komen mesti antara 1 hingga 1000 aksara.', 'body')
        }
        return transaction(() => {
          requirePost(id)
          return stores.comments.insert({
            perutusanId: id,
            userId: viewer.id,
            body: text,
            status: 'pending',
            createdAt: nowIso(),
          })
        })
      },

      /** Approved comments of a post, oldest first (BR-M09-26). */
      comments(id: number): PerutusanCommentRow[] {
        return approvedComments(id)
      },

      /** BR-M09-22/28: creates a post; the pin limit is 2 published posts per scope. */
      create(author: Viewer, input: PerutusanInput): PerutusanRow {
        const scope =
          author.role === 'admin' ? 'national' : author.role === 'school_admin' ? 'school' : null
        if (scope === null)
          throw new M09Error('FORBIDDEN', 'Anda tidak dibenarkan menulis perutusan.')
        const schoolId = scope === 'school' ? author.schoolId : null
        if (scope === 'school' && schoolId === null) {
          throw new M09Error(
            'VALIDATION_ERROR',
            'Pentadbir sekolah mesti mempunyai sekolah.',
            'form',
          )
        }
        return transaction(() => {
          // INFERRED (review G4): scheduled pinned posts count towards the limit too, so three
          // scheduled pins cannot all go live; a draft pin does not count.
          if (input.isPinned && input.status !== 'draft') {
            const pinned = (['published', 'scheduled'] as const).reduce(
              (n, status) =>
                n + store.query({ where: { isPinned: true, status, scope, schoolId } }).total,
              0,
            )
            if (pinned >= MAX_PINNED_PER_SCOPE) {
              throw new M09Error(
                'VALIDATION_ERROR',
                'Maksimum 2 perutusan boleh disematkan.',
                'isPinned',
              )
            }
          }
          const now = nowIso()
          return store.insert({
            title: input.title,
            body: input.body,
            images: input.images ?? [],
            documents: input.documents ?? [],
            youtubeUrl: input.youtubeUrl ?? null,
            isPinned: input.isPinned ?? false,
            isPublic: input.isPublic ?? false,
            status: input.status,
            scheduledAt:
              input.status === 'scheduled' && input.scheduledAt
                ? toIsoMyt(toEpochMs(input.scheduledAt))
                : null,
            scope,
            schoolId,
            authorId: author.id,
            reads: 0,
            createdAt: now,
            updatedAt: now,
          })
        })
      },
    }
  },
})
