/**
 * The Bab and SP lookups of the chosen Subjek + Tingkatan for the "Soalan & Rujukan" form (D112): the same calls and the
 * same "none exist" reading as `QuestionForm` of S6-T06 (API-GUR-08 chapters, API-DSKP-07 SP), as a composable.
 * A failed lookup keeps its fields required (never "none exist") and `failed` drives the retry box.
 */
import { computed, reactive, ref, type Ref } from 'vue'

import { fetchChapters } from '../../api/guru'
import type { ChapterOption } from '../../api/types'
import { fetchSpChoices, type SpChoice } from '../soalan/dskp-lookup'
import type { DskpContext } from '../soalan/dskp-rule'

export function useDskpPair(levelId: Ref<string>, subjectId: Ref<string>) {
  const chapters = ref<ChapterOption[]>([])
  const sps = ref<SpChoice[]>([])
  /** The lists of the chosen pair have been answered (so an empty list means "none exist"). */
  const loaded = reactive({ chapters: false, sps: false })
  const failed = reactive({ chapters: false, sps: false })
  const seq = { chapters: 0, sp: 0 }

  const ready = computed(() => levelId.value !== '' && subjectId.value !== '')

  /** Loads both lists; resolves when both have settled (a stale answer is dropped). */
  async function load(): Promise<void> {
    seq.chapters++
    seq.sp++
    chapters.value = []
    sps.value = []
    loaded.chapters = false
    loaded.sps = false
    failed.chapters = false
    failed.sps = false
    if (!ready.value) return
    const query = { subjectId: Number(subjectId.value), educationLevelId: Number(levelId.value) }
    const chapterToken = seq.chapters
    const spToken = seq.sp
    await Promise.all([
      fetchChapters(query)
        .then((list) => {
          if (chapterToken === seq.chapters) {
            chapters.value = [...list].sort(
              (a, b) => (a.chapterNumber ?? 0) - (b.chapterNumber ?? 0),
            )
          }
        })
        .catch(() => {
          if (chapterToken === seq.chapters) failed.chapters = true
        })
        .finally(() => {
          if (chapterToken === seq.chapters) loaded.chapters = true
        }),
      fetchSpChoices(query)
        .then((list) => {
          if (spToken === seq.sp) sps.value = list
        })
        .catch(() => {
          if (spToken === seq.sp) failed.sps = true
        })
        .finally(() => {
          if (spToken === seq.sp) loaded.sps = true
        }),
    ])
  }

  const ctx = computed<DskpContext>(() => ({
    hasChapters: chapters.value.length > 0 || failed.chapters,
    hasDskpNodes: sps.value.length > 0 || failed.sps,
  }))
  const noChapters = computed(
    () => ready.value && loaded.chapters && !failed.chapters && chapters.value.length === 0,
  )
  const noSps = computed(() => ready.value && loaded.sps && !failed.sps && sps.value.length === 0)
  const lookupFailed = computed(() => failed.chapters || failed.sps)

  return { chapters, sps, ready, ctx, noChapters, noSps, lookupFailed, load }
}
