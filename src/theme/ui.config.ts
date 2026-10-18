/**
 * Nuxt UI theme config (V2-T03). Handed to the `@nuxt/ui/vite` plugin as its `ui` option (same
 * shape as `app.config.ts` `ui`). Spec: docs/design/v2-design-system.md section 5.
 *
 * One config serves both personalities. Where the learner differs, the class uses the Tailwind
 * `learner:` variant, so a component never needs to know which portal it is
 * in. Colours come from the semantic utilities (`bg-elevated`, `text-primary-on`, ...) that
 * `tokens.css` resolves per personality and colour mode; no palette step is named here.
 *
 * "Layers, not lines": `tokens.css` makes `--ui-border*` transparent for both personalities, so
 * every Nuxt UI `ring-default`, `border-default` and `divide-default` already draws nothing. This
 * file removes the coloured rings that tokens cannot reach (`ring-primary/50` on outline buttons,
 * `ring-error/25` on subtle alerts and badges).
 */

import { dsIconClasses, learnIconClasses } from './ds-icons.ts'

/** Filled, borderless field with a 2px primary focus ring (D34). */
const filled =
  'bg-elevated text-highlighted hover:bg-accented focus:bg-elevated disabled:bg-elevated/50 focus-visible:ring-2 focus-visible:ring-inset'

/** Field height: staff 40px (44px on coarse pointers), learner 52px; text is 16px on every size. */
/**
 * Radius scale (tokens.css): xs 4 tags and checkboxes, sm 8 inputs, md 12 buttons and segmented
 * lists, lg 16 cards and tables, xl 24 modals and hero cards, full pills. Inputs sit one step below
 * the buttons beside them; a control inside a card is always smaller than the card.
 */
const fieldSize = 'min-h-11 learner:min-h-13 rounded-sm px-3.5 text-base md:staff:text-body'

const fieldConfig = {
  defaultVariants: { variant: 'soft' },
  variants: {
    variant: { soft: filled },
    size: {
      md: { base: fieldSize },
      lg: { base: fieldSize },
    },
  },
  // Error / highlight state: 2px inset ring (the theme default is 1px).
  compoundVariants: [{ highlight: true, class: 'ring-2' }],
}

/**
 * Nuxt UI's internal icons, remapped from Lucide to Phosphor (design system section 10.1: Lucide is
 * retired for v2; staff weight = Regular, bold only for small status glyphs).
 */
const icons = {
  arrowDown: 'i-ph-arrow-down',
  arrowLeft: 'i-ph-arrow-left',
  arrowRight: 'i-ph-arrow-right',
  arrowUp: 'i-ph-arrow-up',
  caution: 'i-ph-warning-circle',
  check: 'i-ph-check-bold',
  chevronDoubleLeft: 'i-ph-caret-double-left',
  chevronDoubleRight: 'i-ph-caret-double-right',
  chevronDown: 'i-ph-caret-down',
  chevronLeft: 'i-ph-caret-left',
  chevronRight: 'i-ph-caret-right',
  chevronUp: 'i-ph-caret-up',
  close: 'i-ph-x',
  copy: 'i-ph-copy',
  copyCheck: 'i-ph-check-square',
  dark: 'i-ph-moon',
  drag: 'i-ph-dots-six-vertical',
  ellipsis: 'i-ph-dots-three',
  error: 'i-ph-x-circle',
  external: 'i-ph-arrow-up-right',
  eye: 'i-ph-eye',
  eyeOff: 'i-ph-eye-slash',
  file: 'i-ph-file',
  folder: 'i-ph-folder',
  folderOpen: 'i-ph-folder-open',
  hash: 'i-ph-hash',
  info: 'i-ph-info',
  light: 'i-ph-sun',
  loading: 'i-ph-circle-notch',
  menu: 'i-ph-list',
  minus: 'i-ph-minus',
  panelClose: 'i-ph-sidebar-simple',
  panelOpen: 'i-ph-sidebar-simple',
  plus: 'i-ph-plus',
  reload: 'i-ph-arrow-counter-clockwise',
  search: 'i-ph-magnifying-glass',
  stop: 'i-ph-square',
  star: 'i-ph-star',
  success: 'i-ph-check-circle',
  system: 'i-ph-monitor',
  tip: 'i-ph-lightbulb',
  upload: 'i-ph-upload',
  warning: 'i-ph-warning',
}

/**
 * Icons bundled offline besides the ones found by the source scan: Nuxt UI's internal icons above
 * (the plugin only trusts Lucide automatically) and every glyph the app names without a
 * literal "i-ph-*" string (a future DsIcon that builds names from a base name must list its set here).
 */
export const iconBundle = {
  icons: [...new Set([...Object.values(icons), ...dsIconClasses, ...learnIconClasses])],
  scan: {
    globInclude: ['src/**/*.{vue,ts}'],
    globExclude: ['node_modules', 'dist', '**/__tests__/**'],
  },
  // The v2 shells (learner menu glyphs, duotone + regular) and the restyled pages push the bundle
  // just past the 256KB default; the icons stay bundled so the demo needs no icon API at runtime.
  sizeLimitKb: 384,
}

export const uiConfig = {
  icons,
  colors: {
    primary: 'kobalt',
    secondary: 'limau',
    success: 'daun',
    info: 'laut',
    warning: 'mentari',
    error: 'delima',
    neutral: 'ink',
  },

  // D34: no outline buttons. Tonal (`soft`) is the default; `outline` and `subtle` become the
  // neutral tonal fill (primary / neutral colours) and lose every ring.
  button: {
    slots: {
      base: 'font-semibold transition-[transform,box-shadow,background-color] duration-200 ease-pop active:scale-[.97] disabled:opacity-40 aria-disabled:opacity-40',
    },
    defaultVariants: { variant: 'soft' },
    variants: {
      size: {
        xs: { base: 'min-h-9 px-2.5 text-label' },
        sm: { base: 'min-h-10 px-3.5 text-label' },
        md: {
          base: 'min-h-11 gap-2 px-4 text-label learner:min-h-13 learner:rounded-md learner:px-5 learner:text-base',
        },
        lg: {
          base: 'min-h-12 gap-2.5 px-5 text-label learner:min-h-14 learner:rounded-md learner:px-6 learner:text-base',
        },
      },
    },
    compoundVariants: [
      { variant: ['outline', 'subtle'], class: 'ring-0' },
      {
        color: ['primary', 'neutral'],
        variant: ['outline', 'subtle'],
        class: 'bg-elevated text-highlighted hover:bg-accented active:bg-accented',
      },
      // Solid primary: gradient in the learner portal, flat in staff (token), label from `primary-on`.
      {
        color: 'primary',
        variant: 'solid',
        class:
          'bg-gradient-primary text-primary-on shadow-cta hover:brightness-110 active:brightness-95',
      },
      { color: 'secondary', variant: 'solid', class: 'bg-highlight text-on-highlight' },
      { color: ['error', 'success', 'info', 'warning'], variant: 'solid', class: 'text-on-sem' },
      // Staff: a primary button (the default colour) is the page's main action, so it is solid even
      // when the caller leaves the variant at the tonal default. Secondary actions say `color="neutral"`.
      {
        color: 'primary',
        variant: 'soft',
        class:
          'staff:bg-gradient-primary staff:text-primary-on staff:shadow-cta staff:hover:bg-primary staff:hover:brightness-110 staff:active:brightness-95',
      },
      // Tonal / link text in the readable tone of the primary (`--ds-primary-t`).
      { color: 'primary', variant: ['soft', 'ghost', 'link'], class: 'text-primary-t' },
    ],
  },

  input: fieldConfig,
  textarea: fieldConfig,
  select: fieldConfig,
  selectMenu: fieldConfig,
  inputMenu: fieldConfig,
  inputNumber: fieldConfig,
  inputDate: fieldConfig,
  inputTime: fieldConfig,
  inputTags: fieldConfig,
  pinInput: { defaultVariants: { variant: 'soft' }, variants: { variant: { soft: filled } } },

  // Pager wraps instead of overflowing on narrow screens (S-08 / S-09).
  pagination: { slots: { root: 'max-w-full', list: 'flex-wrap justify-center' } },

  // Raised surface with a soft shadow, no divider lines.
  card: {
    slots: {
      root: 'rounded-card',
      header: 'p-4 sm:px-5',
      body: 'p-4 sm:p-5',
      footer: 'p-4 sm:px-5',
    },
    variants: {
      variant: {
        outline: { root: 'bg-default shadow-lift ring-0 divide-y-0' },
        soft: { root: 'bg-elevated divide-y-0' },
        subtle: { root: 'bg-elevated ring-0 divide-y-0' },
      },
    },
    defaultVariants: { variant: 'outline' },
  },

  // Segmented control: elevated track, raised chip for the active tab (indicator), no underline.
  // Learner: the active chip is the primary gradient with the on-primary label.
  tabs: {
    defaultVariants: { variant: 'pill', color: 'neutral' },
    slots: { list: 'w-fit max-w-full overflow-x-auto' },
    variants: {
      variant: {
        pill: {
          list: 'bg-elevated rounded-md p-1 gap-1',
          indicator: 'rounded-sm',
          trigger: 'min-h-11',
        },
      },
    },
    compoundVariants: [
      {
        color: 'neutral',
        variant: 'pill',
        class: {
          indicator: 'bg-seg-active shadow-ds-xs learner:bg-gradient-primary learner:shadow-cta',
          trigger:
            'data-[state=active]:text-highlighted learner:data-[state=active]:text-primary-on',
        },
      },
    ],
  },

  // Touch targets >= 44px. Dots: a 44px button painting a 12px dot (padding + bg-clip-content).
  // Checkbox / switch: the container is a 44px box with the control centred.
  carousel: { slots: { dot: 'size-11 rounded-full bg-clip-content p-4' } },
  checkbox: {
    slots: {
      container: 'min-h-11 min-w-11 justify-center',
      // Borders are transparent (layers, not lines): an unchecked box needs its own fill to show.
      base: "relative overflow-visible rounded-xs bg-accented after:absolute after:-inset-2.5 after:content-['']",
    },
    variants: { size: { md: { base: 'size-6' }, sm: { base: 'size-6' } } },
  },

  switch: {
    slots: {
      container: 'min-h-11 min-w-11 justify-center',
      base: "relative after:absolute after:-inset-2 after:content-['']",
    },
  },
  navigationMenu: {
    slots: {
      link: 'min-h-11 gap-3 px-3 text-label',
      childLink: 'min-h-11 px-3 text-label',
      linkLeadingIcon: 'size-5',
    },
    // Nested groups (Kirkpatrick) step in by 8px, not 20px, so long labels read in full.
    variants: {
      orientation: {
        vertical: { childList: 'ms-3', childItem: 'ps-0' },
      },
    },
  },

  dashboardSidebar: { slots: { root: 'bg-default shadow-ds-xs' } },
  dashboardNavbar: { slots: { root: 'h-16 bg-default shadow-bar' } },

  modal: {
    slots: {
      overlay: 'z-50 bg-(--ds-overlay)',
      content: 'z-50 divide-y-0',
    },
    variants: {
      fullscreen: { false: { content: 'rounded-xl shadow-modal ring-0' } },
    },
  },
  // Overlays sit above the shell chrome (sidebar and bars are z-30): modal surfaces never hide behind it.
  slideover: {
    slots: { overlay: 'z-50 bg-(--ds-overlay)', content: 'z-50 divide-y-0 shadow-modal ring-0' },
  },
  drawer: {
    slots: { overlay: 'z-50 bg-(--ds-overlay)', content: 'z-50 bg-elevated shadow-modal ring-0' },
  },

  // Zebra rows on the raised surface, no row lines.
  table: {
    slots: {
      root: 'bg-default rounded-lg shadow-ds-xs in-data-[ds=panel]:rounded-none in-data-[ds=panel]:shadow-none',
      tbody: 'divide-y-0 [&>tr:nth-child(even)]:bg-soft',
      th: 'px-4 py-3 text-th text-muted',
      td: 'px-4 py-3 text-body tabular-nums',
    },
  },

  badge: {
    // One badge style: sentence case, 12px semibold (13px label in the learner portal).
    slots: { base: 'rounded-full font-semibold tabular-nums' },
    variants: {
      size: {
        // `text-xs` (not the `text-badge` role) so it replaces the stock xs/sm sizes (8px / 10px).
        xs: { base: 'rounded-full text-xs px-2 py-0.5 learner:text-caption' },
        sm: { base: 'rounded-full text-xs px-2 py-0.5 learner:text-caption learner:px-2.5 learner:py-1' },
        md: { base: 'rounded-full text-xs px-2.5 py-1 learner:text-label learner:px-3' },
        lg: { base: 'rounded-full' },
        xl: { base: 'rounded-full' },
      },
    },
    compoundVariants: [
      { variant: ['outline', 'subtle'], class: 'ring-0' },
      { color: 'primary', variant: 'solid', class: 'text-primary-on' },
      { color: ['error', 'success', 'info', 'warning'], variant: 'solid', class: 'text-on-sem' },
      { color: 'secondary', variant: 'solid', class: 'bg-highlight text-on-highlight' },
    ],
  },

  // Card radios: selected = tinted surface (info mix), never a line (the stock card draws a
  // coloured border).
  // The radio dot gets a fill too: its ring token is transparent, so an unchecked radio would be invisible.
  radioGroup: {
    slots: { base: 'bg-accented' },
    compoundVariants: [
      { variant: 'card', class: { item: 'border-0' } },
      { variant: 'card', color: 'info', class: { item: 'has-data-[state=checked]:bg-info/20' } },
    ],
  },

  alert: {
    compoundVariants: [{ variant: ['outline', 'subtle'], class: { root: 'ring-0' } }],
  },

  toast: { slots: { root: 'bg-elevated shadow-modal ring-0 rounded-md' } },

  progress: {
    slots: { base: 'bg-elevated', status: 'tabular-nums font-bold text-default' },
  },
}
