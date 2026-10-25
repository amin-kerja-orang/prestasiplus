/**
 * m28's only door to the DSKP catalogue (D12, ADR-0022): the catalogue is owned and loaded by M03
 * (`dskpCatalog`), and m28 reads it through here. This file builds the narrow `TagLookup` that the
 * tag rule needs (the rule itself never sees M03), loads subjects for pages and the server, and
 * holds the one test seam. No catalogue schema is copied.
 */
import { shallowRef, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter, Ref, ShallowRef } from 'vue'

import { dskpCatalog, DSKP_FLAG_LABELS, DSKP_REVIEW_BADGE_FLAGS, parseDskpKey } from '@/modules/m03-curriculum'
import type {
  DskpCatalog,
  DskpSpId as CatalogSpId,
  DskpSubjectInfo,
  DskpSubjectView,
  DskpUnitId as CatalogUnitId,
} from '@/modules/m03-curriculum'

import type { TagLookup } from '../domain/tag-rule'

export { DSKP_FLAG_LABELS, DSKP_REVIEW_BADGE_FLAGS }
export type {
  DskpFlag,
  DskpGroupNode,
  DskpSkNode,
  DskpSpNode,
  DskpSubjectInfo,
  DskpSubjectView,
  DskpUnitNode,
  TpResolved,
} from '@/modules/m03-curriculum'

let catalog: DskpCatalog = dskpCatalog

/** The catalogue m28 currently reads (the real one unless a test replaced it). */
export function dskpSource(): DskpCatalog {
  return catalog
}

/** Test seam: read a fixture catalogue (`createDskpCatalog(loaders)`); no argument restores the real one. */
export function setDskpCatalogForTests(c?: DskpCatalog): void {
  catalog = c ?? dskpCatalog
}

/** The catalogue version stamped on a tag when a unit or SP is chosen. */
export const catalogueVersion = (): string => catalog.version

/** The 13 catalogue subjects (the subjects a question can be tagged with). */
export const dskpSubjects = (): readonly DskpSubjectInfo[] => catalog.subjects()

/**
 * A `TagLookup` over the catalogue. It is synchronous, as the rule is, so it only knows the subjects
 * that are already loaded: an id of an unloaded subject answers `undefined`. Use `tagLookupFor` when
 * the subjects may not be loaded yet.
 */
export function tagLookup(): TagLookup {
  return {
    subject: (code) => catalog.subject(code) !== undefined,
    unit(id) {
      const key = parseDskpKey(id)
      if (!key || key.kind !== 'u') return undefined
      const u = catalog.loaded(key.subject)?.unit(id as CatalogUnitId)
      return u ? { subject: u.subject, tingkatan: u.tingkatan, title: u.title } : undefined
    },
    sp(id) {
      const key = parseDskpKey(id)
      if (!key || key.kind !== 'sp') return undefined
      const sp = catalog.loaded(key.subject)?.sp(id as CatalogSpId)
      return sp ? { unitId: sp.unitId, selectable: sp.selectable } : undefined
    },
  }
}

/**
 * Load each subject once (cached by M03) and return the lookup. Codes the catalogue does not list
 * are skipped, so a tag with an unknown subject fails the rule instead of rejecting here; a failed
 * load rejects with M03's `DskpLoadError`.
 */
export async function tagLookupFor(subjects: Iterable<string>): Promise<TagLookup> {
  const codes = [...new Set(subjects)].filter((c) => catalog.subject(c) !== undefined)
  await Promise.all(codes.map((c) => catalog.load(c)))
  return tagLookup()
}

export interface DskpSubjectState {
  /** The loaded subject; undefined while loading, on error and when no subject is given. */
  view: ShallowRef<DskpSubjectView | undefined>
  loading: Ref<boolean>
  error: Ref<Error | undefined>
  /** Try again after an error. */
  retry: () => void
}

/**
 * Load one subject for a page or component (the editor block shows a skeleton while `loading` and a
 * retry on `error`). Follows a reactive subject; a stale answer for a previous subject is ignored.
 */
export function useDskpSubject(subject: MaybeRefOrGetter<string | null | undefined>): DskpSubjectState {
  const view = shallowRef<DskpSubjectView | undefined>()
  const loading = ref(false)
  const error = ref<Error | undefined>()
  let token = 0

  function run(code: string | null | undefined): void {
    const mine = ++token
    error.value = undefined
    if (!code || catalog.subject(code) === undefined) {
      view.value = undefined
      loading.value = false
      return
    }
    const ready = catalog.loaded(code)
    if (ready) {
      view.value = ready
      loading.value = false
      return
    }
    view.value = undefined
    loading.value = true
    catalog.load(code).then(
      (v) => {
        if (mine !== token) return
        view.value = v
        loading.value = false
      },
      (e: unknown) => {
        if (mine !== token) return
        error.value = e instanceof Error ? e : new Error(String(e))
        loading.value = false
      },
    )
  }

  watch(() => toValue(subject), run, { immediate: true })
  return { view, loading, error, retry: () => run(toValue(subject)) }
}
