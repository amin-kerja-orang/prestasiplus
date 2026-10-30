/** Data shapes of `DsAdminShell` (the Portal Pentadbiran chrome). Plain data: no class names. */

export interface DsShellNavLink {
  kind: 'link'
  id: string
  label: string
  /** Full `i-ph-*` icon name (literals live in the caller so the icon bundler finds them). */
  icon: string
  to: string
  active: boolean
  /** Indented under a sub-group label. */
  nested?: boolean
}

export interface DsShellNavSub {
  kind: 'sub'
  label: string
}

export interface DsShellNavGroup {
  key: string
  label: string
  rows: readonly (DsShellNavLink | DsShellNavSub)[]
}

export type DsShellAccountIcon = 'settings' | 'theme' | 'student' | 'logout'

export interface DsShellAccountItem {
  label: string
  icon?: DsShellAccountIcon
  to?: string
  tone?: 'error'
  /** A non-interactive heading row. */
  heading?: boolean
  onSelect?: () => void
}

export interface DsShellSearchGroup {
  id: string
  label: string
  items: readonly {
    id: string
    label: string
    suffix?: string | undefined
    icon: string
    to: string
  }[]
}
