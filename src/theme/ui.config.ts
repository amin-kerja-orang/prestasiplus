/**
 * Nuxt UI theme config (V2-T03). Handed to the `@nuxt/ui/vite` plugin as its `ui` option (same
 * shape as `app.config.ts` `ui`). Spec: docs/design/v2-design-system.md section 5.
 *
 * One config serves both personalities. Where the learner differs, the class uses the Tailwind
 * `[[data-personality=learner]_&]:` variant, so a component never needs to know which portal it is
 * in. Colours come from the semantic utilities (`bg-elevated`, `text-primary-on`, ...) that
 * `tokens.css` resolves per personality and colour mode; no palette step is named here.
 *
 * "Layers, not lines": `tokens.css` makes `--ui-border*` transparent for both personalities, so
 * every Nuxt UI `ring-default`, `border-default` and `divide-default` already draws nothing. This
 * file removes the coloured rings that tokens cannot reach (`ring-primary/50` on outline buttons,
 * `ring-error/25` on subtle alerts and badges).
 */

/** Filled, borderless field with a 2px primary focus ring (D34). */
const filled =
  'bg-elevated text-highlighted hover:bg-accented focus:bg-elevated disabled:bg-elevated/50 focus-visible:ring-2 focus-visible:ring-inset'

/** Field height: staff 40px (44px on coarse pointers), learner 52px; text is 16px on every size. */
const fieldSize =
  'min-h-10 pointer-coarse:min-h-11 [[data-personality=learner]_&]:min-h-13 text-base'

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
  icons: Object.values(icons),
  scan: {
    globInclude: ['src/**/*.{vue,ts}'],
    globExclude: ['node_modules', 'dist', '**/__tests__/**'],
  },
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
        md: {
          base: 'min-h-9 pointer-coarse:min-h-11 [[data-personality=learner]_&]:min-h-13 [[data-personality=learner]_&]:rounded-lg [[data-personality=learner]_&]:px-5',
        },
        lg: {
          base: 'min-h-10 pointer-coarse:min-h-11 [[data-personality=learner]_&]:min-h-14 [[data-personality=learner]_&]:rounded-lg [[data-personality=learner]_&]:px-6',
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

  // Raised surface with a soft shadow, no divider lines.
  card: {
    slots: { root: 'rounded-card' },
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
          list: 'bg-elevated rounded-lg p-1 gap-1',
          trigger: 'min-h-11',
        },
      },
    },
    compoundVariants: [
      {
        color: 'neutral',
        variant: 'pill',
        class: {
          indicator:
            'bg-seg-active shadow-ds-xs [[data-personality=learner]_&]:bg-gradient-primary [[data-personality=learner]_&]:shadow-cta',
          trigger:
            'data-[state=active]:text-highlighted [[data-personality=learner]_&]:data-[state=active]:text-primary-on',
        },
      },
    ],
  },

  navigationMenu: {
    slots: { link: 'min-h-10 pointer-coarse:min-h-12' },
  },

  dashboardSidebar: { slots: { root: 'bg-default shadow-ds-xs' } },
  dashboardNavbar: { slots: { root: 'bg-default shadow-bar' } },

  modal: {
    slots: {
      overlay: 'bg-(--ds-overlay)',
      content: 'divide-y-0',
    },
    variants: {
      fullscreen: { false: { content: 'rounded-lg shadow-modal ring-0' } },
    },
  },
  slideover: { slots: { overlay: 'bg-(--ds-overlay)', content: 'divide-y-0 shadow-modal ring-0' } },
  drawer: { slots: { overlay: 'bg-(--ds-overlay)', content: 'bg-elevated shadow-modal ring-0' } },

  // Zebra rows on the raised surface, no row lines.
  table: {
    slots: {
      root: 'bg-default rounded-lg shadow-ds-xs',
      tbody: 'divide-y-0 [&>tr:nth-child(even)]:bg-soft',
      th: 'text-overline uppercase text-muted',
      td: 'tabular-nums',
    },
  },

  badge: {
    slots: { base: 'rounded-full font-bold tabular-nums' },
    variants: {
      size: {
        xs: { base: 'rounded-full' },
        sm: { base: 'rounded-full' },
        md: { base: 'rounded-full' },
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

  alert: {
    compoundVariants: [{ variant: ['outline', 'subtle'], class: { root: 'ring-0' } }],
  },

  toast: { slots: { root: 'bg-elevated shadow-modal ring-0 rounded-lg' } },

  progress: {
    slots: { base: 'bg-elevated', status: 'tabular-nums font-bold text-default' },
  },
}
