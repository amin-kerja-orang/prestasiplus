import { Inject, Injectable } from '@nestjs/common'
import { STIMULUS_LIMITS, STIMULUS_MESSAGES as M } from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'
import { StimuliRepository } from './stimuli.repository'

const fail = (fields: Record<string, string>): ApiError => ApiError.of('VALIDATION_ERROR', { fields })
const notFound = (): ApiError => ApiError.of('NOT_FOUND', { message: M.groupNotFound })
const conflict = (message: string): ApiError => ApiError.of('CONFLICT', { message })

/** Parked position while a group is renumbered (the partial unique key on (group, position) is checked row by row). */
const PARK = 5000

/**
 * The ONE place that changes the members of a stimulus group (R1-T32, D90, D93). `StimuliService` (the stimulus routes) and
 * `QuestionsService` (`stimulusGroupId` on POST / PUT /api/questions) both go through it, so a group can never be changed by a path
 * that skips its rules. Every method must run inside a transaction: it locks the group row and the question rows it touches.
 *
 * Rules:
 * - a member exists, is not a PKSK question, is active and not archived, and is in no other group;
 * - the members of a group share a subject (the level may differ: an SPM figure can serve a Tingkatan 4 and a Tingkatan 5 question) and,
 *   when it is set, the kertas (a question with no kertas fits any);
 * - at most 40 members;
 * - SERVED LOCK: a question shown to pupils (active with an approved live version, or pinned by a published paper) cannot be added to, removed from or reordered within a
 *   group (it must be edited as a draft or archived first); the group's served members keep their relative order and stay. New draft
 *   or review questions can still be added, appended at the end, so a group can be built up (and intake can add the next item of a
 *   figure) while its first question is already served.
 * - fewer than 2 members is allowed (a draft group, D93) and answers with a warning.
 */
@Injectable()
export class GroupMembers {
  constructor(@Inject(StimuliRepository) private readonly repo: StimuliRepository) {}

  /** Locks the group row; 404 when it does not exist. */
  async lock(groupId: string): Promise<void> {
    if (!(await this.repo.lockGroup(groupId))) throw notFound()
  }

  /** The BM warning for a group with fewer than 2 members, else null. */
  warning(count: number): string | null {
    return count < 2 ? M.smallGroup(count) : null
  }

  /** Throws 409 when the group has a member shown to pupils (for the changes that cannot keep them as they are). */
  async assertNotServed(groupId: string): Promise<void> {
    if ((await this.repo.servingMemberIds(groupId)).length > 0) throw conflict(M.groupServed)
  }

  /**
   * Makes `ordered` the members of the group, in that order. Adds, removals and reordering in one call; an unchanged list is a no-op.
   * Returns the members after the change.
   */
  async set(groupId: string, ordered: readonly string[], field = 'questionIds'): Promise<string[]> {
    await this.lock(groupId)
    if (new Set(ordered).size !== ordered.length) throw fail({ [field]: M.membersInvalid })
    if (ordered.length > STIMULUS_LIMITS.groupQuestions) throw fail({ [field]: M.membersTooMany })
    const current = await this.repo.memberIds(groupId)
    const added = ordered.filter((q) => !current.includes(q))
    const removed = current.filter((q) => !ordered.includes(q))
    const unchanged = added.length === 0 && removed.length === 0 && current.every((q, i) => ordered[i] === q)
    if (unchanged) return [...current]

    // Served lock: the served members stay, in their order.
    const serving = new Set(await this.repo.servingMemberIds(groupId))
    if (serving.size > 0) {
      const keptOrder = ordered.filter((q) => serving.has(q))
      const before = current.filter((q) => serving.has(q))
      if (keptOrder.length !== before.length || keptOrder.some((q, i) => q !== before[i])) throw conflict(M.groupServed)
    }

    const touched = [...new Set([...added, ...removed, ...ordered])]
    const facts = await this.repo.lockQuestions(touched)
    for (const q of added) {
      const f = facts.get(q)
      if (f === undefined || f.pksk) throw fail({ [field]: M.membersInvalid })
      if (f.groupId !== null) throw fail({ [field]: f.groupId === groupId ? M.memberExists : M.memberTaken })
      if (!f.active || f.archived) throw fail({ [field]: M.memberInactive })
      if (f.served) throw conflict(M.memberServed)
    }
    // One subject across the group, and one kertas among the members that have one.
    const subjects = new Set<string>()
    const kertas = new Set<string>()
    for (const q of ordered) {
      const f = facts.get(q)
      if (f === undefined) continue
      subjects.add(f.subjectId ?? '')
      if (f.kertas !== null) kertas.add(f.kertas)
    }
    if (subjects.size > 1) throw fail({ [field]: M.memberMixed })
    if (kertas.size > 1) throw fail({ [field]: M.memberKertas })

    for (const q of removed) await this.repo.detachQuestion(q)
    if (added.length > 0) await this.repo.attachQuestions(groupId, added, PARK)
    await this.repo.renumber(groupId, ordered)
    await this.repo.touchGroup(groupId)
    return [...ordered]
  }

  /**
   * A NEW question joins the group while it is created (`stimulusGroupId` on POST /api/questions): locks the group, checks the cap, that the
   * question has the group's subject and a compatible kertas, and returns its position (the end). The question is not in the group yet, so
   * it is not counted; it can be served at once only when it is created already approved (an admin shortcut), which does not bind the group.
   */
  async joinNew(groupId: string, subjectId: string | null, kertas: '1' | '2' | '3' | null): Promise<number> {
    await this.lock(groupId).catch(() => {
      throw fail({ stimulusGroupId: M.groupInvalid })
    })
    const current = await this.repo.memberIds(groupId)
    if (current.length >= STIMULUS_LIMITS.groupQuestions) throw fail({ stimulusGroupId: M.membersTooMany })
    this.assertFits(await this.repo.memberTraits(groupId), subjectId, kertas, 'stimulusGroupId')
    return current.length === 0 ? 1 : (await this.repo.maxPosition(groupId)) + 1
  }

  /**
   * A member's subject or kertas changes (PUT /api/questions on a grouped question): it must still fit the other members, else the group
   * would hold two subjects (or two kertas). The only member of a group may change freely. Runs inside the edit transaction.
   */
  async assertTraitChange(groupId: string, questionId: string, subjectId: string | null, kertas: '1' | '2' | '3' | null): Promise<void> {
    await this.lock(groupId)
    this.assertFits(await this.repo.memberTraits(groupId, questionId), subjectId, kertas, 'subjectId')
  }

  private assertFits(others: readonly { subjectId: string | null; kertas: '1' | '2' | '3' | null }[], subjectId: string | null, kertas: '1' | '2' | '3' | null, field: string): void {
    if (others.some((o) => o.subjectId !== subjectId)) throw fail({ [field]: M.memberMixed })
    if (kertas !== null && others.some((o) => o.kertas !== null && o.kertas !== kertas)) throw fail({ [field === 'subjectId' ? 'kertas' : field]: M.memberKertas })
  }

  /**
   * An existing question changes group (`stimulusGroupId` on PUT /api/questions): leaving a group (null) and joining one go through
   * `set`, so the same rules hold. Moving from one group to another is remove, then add: the answer is `memberTaken`.
   */
  async move(questionId: string, from: string | null, to: string | null): Promise<void> {
    if (to === from) return
    // A question shown to pupils cannot leave its group, whether it goes nowhere or to another group (409, not 422).
    if (from !== null && (await this.repo.servingMemberIds(from)).includes(questionId)) throw conflict(M.groupServed)
    if (from !== null && to !== null) throw fail({ stimulusGroupId: M.memberTaken })
    if (to === null && from !== null) {
      const current = await this.repo.memberIds(from)
      await this.set(
        from,
        current.filter((q) => q !== questionId),
        'stimulusGroupId',
      )
      return
    }
    if (to !== null) {
      await this.lock(to).catch(() => {
        throw fail({ stimulusGroupId: M.groupInvalid })
      })
      const current = await this.repo.memberIds(to)
      await this.set(to, [...current, questionId], 'stimulusGroupId')
    }
  }
}
