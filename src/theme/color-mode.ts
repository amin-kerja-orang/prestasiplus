/**
 * v2 colour mode (V2-T03, spike hazard 1). The app owns light / dark; the Nuxt UI colour-mode
 * plugin is switched off (`colorMode: false` in `vite.config.ts`), because its `useDark()` store
 * key `vueuse-color-scheme` cannot be changed and it follows the OS on every page, which turned
 * legacy pages dark.
 *
 * - Storage key `pp.theme`: `'light' | 'dark' | 'system'`. Absent = the portal default
 *   (learner: dark, staff: system). Changes made in another tab are picked up (`storage` event).
 * - `data-personality`, `.dark` and `color-scheme` are put on <html> only while at least one
 *   portal layout has called `useThemeMode` (so teleported modals, toasts and drawers inherit the
 *   tokens). Mounted layouts form a stack: the most recently mounted one decides the personality,
 *   and the attributes are removed only when the last one unmounts (layout swaps overlap).
 *   Legacy pages never mount one, so they never get `.dark` and stay light.
 * - Tailwind's `dark:` variant and the token scopes in `tokens.css` both key off `.dark`.
 *
 * Known limit: on a hard reload the attributes are applied in `onMounted`, so a learner whose
 * stored/default scheme is dark can see one light frame before the layout mounts.
 */
import {
  computed,
  effectScope,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  type ComputedRef,
  type Ref,
} from 'vue'

export type Personality = 'staff' | 'learner'
export type ThemePreference = 'light' | 'dark' | 'system'
export type Scheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'pp.theme'

/** Default preference per portal (design system section 1.1). */
export function defaultPreference(personality: Personality): ThemePreference {
  return personality === 'learner' ? 'dark' : 'system'
}

function isPreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function readStoredPreference(
  storage: Pick<Storage, 'getItem'> | null,
): ThemePreference | null {
  try {
    const value = storage?.getItem(THEME_STORAGE_KEY)
    return isPreference(value) ? value : null
  } catch {
    return null
  }
}

export function resolveScheme(preference: ThemePreference, systemDark: boolean): Scheme {
  if (preference === 'system') return systemDark ? 'dark' : 'light'
  return preference
}

function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** Module state: one stored choice, shared by every consumer. `null` = never chosen. */
const stored = ref<ThemePreference | null>(readStoredPreference(browserStorage()))
const systemDark = ref(false)
/** Mounted portal layouts, oldest first; the last one is the active personality. */
const owners = shallowRef<{ personality: ComputedRef<Personality> }[]>([])

export const activePersonality = computed<Personality | null>(() => {
  const top = owners.value[owners.value.length - 1]
  return top ? top.personality.value : null
})
const activeScheme = computed<Scheme>(() =>
  resolveScheme(
    stored.value ?? defaultPreference(activePersonality.value ?? 'staff'),
    systemDark.value,
  ),
)

function syncDom(): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const personality = activePersonality.value
  if (personality === null) {
    delete root.dataset.personality
    root.classList.remove('dark')
    root.style.removeProperty('color-scheme')
    return
  }
  root.dataset.personality = personality
  root.classList.toggle('dark', activeScheme.value === 'dark')
  root.style.colorScheme = activeScheme.value
}

let started = false
function start(): void {
  if (started || typeof window === 'undefined') return
  started = true
  if (typeof window.matchMedia === 'function') {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    systemDark.value = query.matches
    query.addEventListener('change', (event) => {
      systemDark.value = event.matches
    })
  }
  window.addEventListener('storage', (event) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) {
      stored.value = readStoredPreference(browserStorage())
    }
  })
  effectScope(true).run(() => {
    watch([activePersonality, activeScheme], syncDom)
  })
}

/** Test hook: forget module state and re-read storage. */
export function resetThemeModeForTests(): void {
  stored.value = readStoredPreference(browserStorage())
  systemDark.value = false
  owners.value = []
  started = false
  syncDom()
}

export interface ThemeMode {
  /** What the user (or the portal default) asked for. */
  preference: Ref<ThemePreference>
  /** The resolved scheme actually applied. */
  scheme: Ref<Scheme>
  setPreference: (value: ThemePreference) => void
  /** Flips the resolved scheme (light <-> dark) and stores it. */
  toggle: () => void
}

/**
 * Called by a portal layout root. Registers the layout as the active portal while mounted and keeps
 * `.dark` / `data-personality` on <html> in step with the preference and, for `system`, the OS.
 */
export function useThemeMode(personality: Ref<Personality> | Personality): ThemeMode {
  const personalityRef = computed(() =>
    typeof personality === 'string' ? personality : personality.value,
  )
  const preference = computed<ThemePreference>(
    () => stored.value ?? defaultPreference(personalityRef.value),
  )
  const scheme = computed<Scheme>(() => resolveScheme(preference.value, systemDark.value))

  const entry = { personality: personalityRef }

  onMounted(() => {
    start()
    owners.value = [...owners.value, entry]
    syncDom()
  })
  onBeforeUnmount(() => {
    owners.value = owners.value.filter((owner) => owner !== entry)
    syncDom()
  })

  function setPreference(value: ThemePreference): void {
    stored.value = value
    try {
      browserStorage()?.setItem(THEME_STORAGE_KEY, value)
    } catch {
      // Storage blocked: the choice lasts for this page view only.
    }
  }

  return {
    preference,
    scheme,
    setPreference,
    toggle: () => setPreference(scheme.value === 'dark' ? 'light' : 'dark'),
  }
}
