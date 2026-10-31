/**
 * Review, student view, Terbitkan, Tarik balik and Salin set of one paper, shared by the Set Builder
 * page (S4.2) and the Semak Kertas page (S4.4). The server's BM lines are shown as they arrive
 * (V2: docs/discovery/cloud-student-mechanism.md 3.4 publish / withdraw / copy flashes).
 */
import type { BijakBuilderReview, BijakBuilderStudentView } from '@pp/contract'
import { computed, ref, type Ref } from 'vue'
import { useRouter } from 'vue-router'

import { useFlash } from '@/composables/useFlash'

import { builderCopy as t } from '../domain/copy'
import { publishGate } from '../domain/publish-gate'
import { builderMessage, builderPath, type BuilderApi } from '../server/api'

export interface PaperActionsOptions {
  api: BuilderApi
  id: Ref<string>
  /** The current title, for the flash lines. */
  title: () => string
  /** Called after Terbitkan or Tarik balik succeeded (reload the editor). */
  onChanged: () => Promise<void> | void
  /** Where Salin set goes; default the Set Builder page of the copy. */
  copyTarget?: (newId: string) => string
}

export function usePaperActions(o: PaperActionsOptions) {
  const flash = useFlash()
  const router = useRouter()

  const review = ref<BijakBuilderReview | null>(null)
  const reviewError = ref(false)
  const busy = ref(false)
  const view = ref<BijakBuilderStudentView | null>(null)
  const viewError = ref(false)
  const viewOpen = ref(false)
  let seq = 0

  async function loadReview(): Promise<void> {
    const mine = ++seq
    try {
      const r = await o.api.review(o.id.value)
      if (mine === seq) {
        review.value = r
        reviewError.value = false
      }
    } catch {
      if (mine === seq) reviewError.value = true
    }
  }

  const blockers = computed(() => review.value?.blockers ?? [])
  /** Terbitkan is off while the server still lists a blocker; the reason is shown next to it. */
  const gate = computed(() =>
    publishGate({ localIssues: 0, dirty: false, reviewFailed: reviewError.value, blockers: blockers.value.length }),
  )
  const publishBlocked = computed(() => gate.value.blocked)
  const publishReason = computed(() => gate.value.reason)

  async function publish(): Promise<boolean> {
    if (busy.value || publishBlocked.value) return false
    busy.value = true
    try {
      const r = await o.api.publish(o.id.value)
      if (!r.ok) {
        flash.show({ type: 'error', message: t.notPublishable(r.errors.length) })
        await loadReview()
        return false
      }
      flash.show({ type: 'success', message: t.publishedFlash(o.title()) })
      await o.onChanged()
      await loadReview()
      return true
    } catch (e) {
      flash.show({ type: 'error', message: builderMessage(e, t.errPublish) })
      return false
    } finally {
      busy.value = false
    }
  }

  async function withdraw(): Promise<void> {
    if (busy.value) return
    busy.value = true
    try {
      await o.api.withdraw(o.id.value)
      flash.show({ type: 'success', message: t.withdrawnFlash(o.title()) })
      await o.onChanged()
      await loadReview()
    } catch (e) {
      flash.show({ type: 'error', message: builderMessage(e, t.errPublish) })
    } finally {
      busy.value = false
    }
  }

  async function copy(): Promise<void> {
    if (busy.value) return
    busy.value = true
    try {
      const nid = await o.api.copy(o.id.value)
      flash.show({ type: 'success', message: t.copied })
      await router.push((o.copyTarget ?? builderPath)(nid))
    } catch (e) {
      flash.show({ type: 'error', message: builderMessage(e, t.errGenerate) })
    } finally {
      busy.value = false
    }
  }

  async function openStudentView(): Promise<void> {
    viewOpen.value = true
    view.value = null
    viewError.value = false
    try {
      view.value = await o.api.studentView(o.id.value)
    } catch {
      viewError.value = true
    }
  }

  return {
    review,
    reviewError,
    loadReview,
    blockers,
    publishBlocked,
    publishReason,
    busy,
    publish,
    withdraw,
    copy,
    view,
    viewError,
    viewOpen,
    openStudentView,
  }
}
