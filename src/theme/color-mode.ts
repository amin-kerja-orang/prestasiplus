/**
 * v2 colour mode (V2-T03, spike hazard 1). The app owns light / dark; the Nuxt UI colour-mode
 * plugin is switched off (`colorMode: false` in `vite.config.ts`), because its `useDark()` store
 * key `vueuse-color-scheme` cannot be changed and it follows the OS on every page, which turned
 * legacy pages dark.
 *
 * - Storage key `pp.theme`: `'light' | 'dark' | 'system'`. Absent = the portal default
 *   (learner: dark, staff: system).
 * - `data-personality`, `.dark` and `color-scheme` are put on <html> only while a portal layout
 *   has called `useThemeMode` (so teleported modals, toasts and drawers inherit the tokens), and
 *   removed when it unmounts. Legacy pages never mount one, so they never get `.dark` and stay
 *   light (no `LegacyScope` workaround needed for the document).
 * - Tailwind's `dark:` variant and the token scopes in `tokens.css` both key off `.dark`.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

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
let mediaBound = false

function bindSystemScheme(): void {
  if (mediaBound || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
  mediaBound = true
  const query = window.matchMedia('(prefers-color-scheme: dark)')
  systemDark.value = query.matches
  query.addEventListener('change', (event) => {
    systemDark.value = event.matches
  })
}

/** Test hook: forget module state and re-read storage. */
export function resetThemeModeForTests(): void {
  stored.value = readStoredPreference(browserStorage())
  systemDark.value = false
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
 * Called by a portal layout root. Applies `.dark` on <html> while mounted and keeps it in step
 * with the preference and, for `system`, the OS scheme.
 */
export function useThemeMode(personality: Ref<Personality> | Personality): ThemeMode {
  const personalityRef = computed(() =>
    typeof personality === 'string' ? personality : personality.value,
  )
  const preference = computed<ThemePreference>(
    () => stored.value ?? defaultPreference(personalityRef.value),
  )
  const scheme = computed<Scheme>(() => resolveScheme(preference.value, systemDark.value))

  function apply(value: Scheme): void {
    const root = document.documentElement
    root.dataset.personality = personalityRef.value
    root.classList.toggle('dark', value === 'dark')
    root.style.colorScheme = value
  }
  function clear(): void {
    const root = document.documentElement
    delete root.dataset.personality
    root.classList.remove('dark')
    root.style.removeProperty('color-scheme')
  }

  onMounted(() => {
    bindSystemScheme()
    apply(scheme.value)
  })
  watch([scheme, personalityRef], () => {
    if (typeof document !== 'undefined') apply(scheme.value)
  })
  onBeforeUnmount(clear)

  function setPreference(value: ThemePreference): void {
    stored.value = value
    try {
      browserStorage()?.setItem(THEME_STORAGE_KEY, value)
    } catch {
      // Storage blocked: the choice lasts for this page view only.
    }
  }

  return {
    preference: preference,
    scheme: scheme,
    setPreference,
    toggle: () => setPreference(scheme.value === 'dark' ? 'light' : 'dark'),
  }
}
