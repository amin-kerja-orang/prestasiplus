/**
 * Catalogue of the custom design tokens defined in theme.css and motion.css (F-02).
 * Used by the dev-only token gallery and by the token compile test.
 * Every class is written out in full so Tailwind detects it (overview §8.2 rule 2).
 */

export interface TokenEntry {
  /** Tailwind utility class that uses the token. */
  className: string
  /** Where the value comes from / what it is used for. */
  note: string
}

export const fontTokens: TokenEntry[] = [
  { className: 'font-body', note: 'Inter (body)' },
  { className: 'font-heading', note: 'Outfit (headings, primary buttons)' },
  { className: 'font-arabic', note: 'Scheherazade New (Arabic / Jawi)' },
]

export const colorTokens: TokenEntry[] = [
  { className: 'bg-live-primary', note: '#6366F1 indigo-500' },
  { className: 'bg-primary-strong', note: '#4F46E5 indigo-600' },
  { className: 'bg-theme', note: '#3B82F6 blue-500 (theme-color)' },
  { className: 'bg-text', note: '#334155 slate-700 (body text)' },
  { className: 'bg-text-strong', note: '#1E293B slate-800 (headings)' },
  { className: 'bg-text-strong-auth', note: '#1F2937 gray-800 (auth headings)' },
  { className: 'bg-muted', note: '#64748B slate-500' },
  { className: 'bg-faint', note: '#94A3B8 slate-400' },
  { className: 'bg-border', note: '#E2E8F0 slate-200' },
  { className: 'bg-border-alt', note: '#E5E7EB gray-200 (auth)' },
  { className: 'bg-danger', note: '#EF4444 red-500' },
  { className: 'bg-live-success', note: '#10B981 emerald-500' },
  { className: 'bg-live-warning', note: '#F59E0B amber-500' },
  { className: 'bg-live-info', note: '#3B82F6 blue-500' },
  { className: 'bg-surface', note: '#FFFFFF' },
  { className: 'bg-surface-translucent', note: 'white 95% (sidebar, topbar)' },
]

export const gradientTokens: TokenEntry[] = [
  { className: 'bg-primary-gradient', note: 'Active nav item, hero cards' },
  { className: 'bg-cta-gradient', note: 'Auth submit buttons' },
  { className: 'bg-save-gradient', note: '"Simpan Profil"' },
  { className: 'bg-warn-gradient', note: '"Tukar Kata Laluan", streak chip' },
  { className: 'bg-command-gradient', note: 'Command Center card' },
  { className: 'bg-app-admin', note: 'Admin shell background' },
  { className: 'bg-app-user', note: 'User shell background' },
  { className: 'bg-auth', note: 'Auth pages background (animate-cool-gradient)' },
  { className: 'bg-error-page', note: '404 background' },
  { className: 'bg-forbidden-page', note: '403 background' },
]

export const shadowTokens: TokenEntry[] = [
  { className: 'shadow-sidebar', note: 'User sidebar' },
  { className: 'shadow-sidebar-admin', note: 'Admin sidebar' },
  { className: 'shadow-topbar', note: 'User header' },
  { className: 'shadow-topbar-admin', note: 'Admin header' },
  { className: 'shadow-nav-active', note: 'Active nav item' },
  { className: 'shadow-bottom-nav', note: 'User bottom nav' },
]

export const motionTokens: TokenEntry[] = [
  { className: 'page-transition', note: 'fadeIn 0.4s (main content)' },
  { className: 'animate-page-transition', note: 'fadeIn 0.4s' },
  { className: 'animate-fade-in', note: 'fadeIn 0.6s' },
  { className: 'animate-bounce-in', note: 'bounceIn 0.5s' },
  { className: 'animate-sparkle', note: 'sparkle 2s' },
  { className: 'animate-cool-gradient', note: 'coolGradient 15s (INFERRED keyframes)' },
  { className: 'animate-float-bounce', note: 'floatBounce 6s (INFERRED keyframes)' },
  { className: 'animate-pop-in', note: 'popIn (INFERRED)' },
  { className: 'animate-mascot-bounce', note: 'mascotBounce (INFERRED)' },
]

/** Custom variants: `hover-none:` = `@media (hover: none)`. */
export const variantTokens: TokenEntry[] = [
  { className: 'hover-none:opacity-100', note: '@media (hover: none)' },
]

export const allTokenGroups = {
  fonts: fontTokens,
  colors: colorTokens,
  gradients: gradientTokens,
  shadows: shadowTokens,
  motion: motionTokens,
  variants: variantTokens,
} as const
