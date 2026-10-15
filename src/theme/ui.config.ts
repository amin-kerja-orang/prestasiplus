/**
 * Nuxt UI theme config (V2-T02 spike proof; V2-T03 owns the final version).
 * Handed to the `@nuxt/ui/vite` plugin as its `ui` option (same shape as `app.config.ts` `ui`).
 */
export const uiConfig = {
  colors: {
    primary: 'kobalt',
    neutral: 'ink',
  },
  // D34: no outline buttons. Tonal (`soft`) is the default; `outline` loses its ring.
  button: {
    defaultVariants: { variant: 'soft' },
    variants: {
      variant: {
        outline: 'ring-0 shadow-none bg-elevated text-default hover:bg-accented',
      },
    },
  },
  // D34: filled, borderless inputs (`soft` = filled, no ring) with a 2px kobalt focus ring.
  input: {
    defaultVariants: { variant: 'soft' },
    variants: {
      variant: {
        soft: 'bg-elevated focus-visible:bg-elevated focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
      },
    },
  },
  select: {
    defaultVariants: { variant: 'soft' },
    variants: {
      variant: {
        soft: 'bg-elevated focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
      },
    },
  },
}
