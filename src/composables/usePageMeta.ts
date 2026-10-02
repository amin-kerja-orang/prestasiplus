/**
 * `usePageMeta()` (overview §5.2, §9): dynamic tab title and shell header set from page data.
 *
 * Static titles and headers come from route meta (`title`, `header`). A page whose title or header
 * depends on loaded data calls `setTitle` / `setHeader`. The router's after-each hook (F-13) calls
 * `reset()` before the new page renders, so a dynamic header never leaks into the next page. Shells
 * show `header` when set, else the route meta header.
 *
 * The state is one app-wide singleton (there is one tab title and one shell header).
 */

import { readonly, reactive } from 'vue'

import { useRouteOutcome } from '@/app/router/outcome'

export interface PageHeader {
  title: string
  subtitle?: string
}

interface PageMetaState {
  /** Dynamic tab title set by the page, or `null` (route meta title applies). */
  title: string | null
  /** Dynamic shell header set by the page, or `null` (route meta header applies). */
  header: PageHeader | null
}

const state = reactive<PageMetaState>({ title: null, header: null })
const readonlyState = readonly(state)

/** Sets the exact tab title (no suffix is added; each SRS gives the full string). */
function setTitle(title: string): void {
  state.title = title
  // An in-place 404/403 keeps its own tab title.
  if (typeof document !== 'undefined' && useRouteOutcome().value === null) {
    document.title = title
  }
}

function setHeader(header: PageHeader | null): void {
  state.header = header ? { ...header } : null
}

/** Clears the dynamic title and header (router after-each). */
function reset(): void {
  state.title = null
  state.header = null
}

export function usePageMeta() {
  return { state: readonlyState, setTitle, setHeader, reset }
}
