/**
 * Nuxt UI component defaults (hardening lever 2, T-H1): the components pages use that had no theme
 * entry. Every entry defines the states a page must never restyle by hand: hover, focus-visible
 * (themed outline, visible in both modes: `outline-primary` resolves per personality and mode),
 * active/pressed, selected, disabled (`--ds-disabled-opacity`), loading, invalid, read-only.
 *
 * Rules: type roles (`text-label`, `text-body`, `text-caption`, `text-overline`) not sizes; tint
 * tokens (`bg-primary-soft`) not opacity; radius hierarchy (popups lg, items sm, controls md);
 * layers not lines (`ring-0`, no coloured borders). Slot names are those of Nuxt UI 4.12.
 */

/** Themed keyboard focus: a 2px primary outline off the edge, never the browser default. */
export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
/** Same, for rows/items that sit flush inside a popup (inset so it is not clipped). */
const focusInset =
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary'
export const disabledState =
  'data-[disabled]:opacity-(--ds-disabled-opacity) data-[disabled]:cursor-not-allowed data-[disabled]:pointer-events-none'

/** Floating panel (menus, selects, popovers): raised layer, no line, one step below modals. */
const panel = 'z-50 rounded-lg bg-default p-1 shadow-modal ring-0'

/** Menu / listbox row shared by dropdown, select, input menu and command palette. */
const item = [
  'min-h-11 gap-2.5 rounded-sm px-3 py-2 text-label transition-colors duration-fast md:min-h-10',
  'data-highlighted:before:bg-elevated data-[state=open]:before:bg-elevated',
  'data-[state=checked]:text-primary-t',
  disabledState,
  focusInset,
].join(' ')

const menuSlots = {
  content: panel,
  viewport: 'divide-y-0 scroll-py-1',
  group: 'p-0',
  empty: 'px-3 py-6 text-body text-muted',
  label: 'px-3 py-2 text-overline text-muted',
  separator: 'mx-0 my-1 h-0.5 bg-elevated',
  item,
  itemLeadingIcon: 'size-5 text-muted group-data-highlighted:text-highlighted',
  itemTrailingIcon: 'size-5 text-primary-t',
  itemLabel: 'text-label',
  itemDescription: 'text-caption text-muted',
}

/** Menu extras shared by select, select menu and input menu (the closed field: fieldConfig). */
export const selectSlots = {
  ...menuSlots,
  placeholder: 'text-dimmed',
  trailingIcon: 'text-muted transition-transform duration-base group-data-[state=open]:rotate-180',
  leadingIcon: 'text-muted',
}

/**
 * Stock size variants set item/label/empty padding, gap and text size, and outrank the slot base
 * (tailwind-variants order: slot, size variant, compounds, caller). So ours live in the size
 * variants, otherwise popup rows fall back to 6px padding. `fieldSizes` keeps a field's own variants.
 */
const sizeKeys = ['xs', 'sm', 'md', 'lg', 'xl']
const menuRowSizes = {
  item: 'gap-2.5 px-3 py-2 text-label',
  label: 'gap-2 px-3 py-2 text-overline',
  empty: 'px-3 py-6 text-body',
}
export function mergeMenuSizes(fieldSizes: Record<string, Record<string, string>> = {}) {
  return Object.fromEntries(
    sizeKeys.map((k) => [k, { ...menuRowSizes, ...fieldSizes[k] }]),
  ) as Record<string, Record<string, string>>
}
/** Dropdown menu has no `empty` slot. */
export const menuItemSizes = Object.fromEntries(
  sizeKeys.map((k) => [k, { item: menuRowSizes.item, label: menuRowSizes.label }]),
)

const soft = (c: string) => ({ root: `bg-${c}-soft text-${c}` })
const tinted = ['soft', 'subtle', 'outline']

export const componentDefaults = {
  // Label, hint, error and required marker: one type role each, so no page styles a field label.
  formField: {
    slots: {
      label: 'text-label font-semibold text-highlighted',
      description: 'text-caption text-muted',
      hint: 'text-caption text-muted',
      help: 'mt-1.5 text-caption text-muted',
      error: 'mt-1.5 text-caption font-medium text-error',
      container: 'mt-1.5',
    },
    variants: {
      size: {
        xs: { root: 'text-label' },
        sm: { root: 'text-label' },
        md: { root: 'text-label' },
        lg: { root: 'text-label' },
        xl: { root: 'text-body' },
      },
    },
  },

  // Tinted alerts use the tint tokens; solid keeps the stock fill.
  alert: {
    slots: {
      root: 'gap-3 rounded-lg p-4',
      title: 'text-label font-semibold',
      description: 'text-body opacity-100',
      icon: 'size-5',
      // Compact square so a one-line closable alert stays one line (button md is 44px, 52px learner).
      close: 'size-8 min-h-0 p-0 learner:size-8 learner:min-h-0 self-start -my-1',
    },
    defaultVariants: { variant: 'soft' },
    compoundVariants: [
      { variant: ['outline', 'subtle'], class: { root: 'ring-0' } },
      { variant: tinted, color: 'primary', class: { root: 'bg-primary-soft text-primary-t' } },
      { variant: tinted, color: 'secondary', class: { root: 'bg-highlight-soft text-highlighted' } },
      { variant: tinted, color: 'success', class: soft('success') },
      { variant: tinted, color: 'warning', class: soft('warning') },
      { variant: tinted, color: 'error', class: soft('error') },
      { variant: tinted, color: 'info', class: soft('info') },
      { variant: tinted, color: 'neutral', class: { root: 'bg-elevated text-default' } },
    ],
  },

  avatar: {
    slots: { root: 'select-none', fallback: 'font-semibold uppercase' },
    variants: {
      color: {
        primary: { root: 'bg-primary-soft', fallback: 'text-primary-t', icon: 'text-primary-t' },
        secondary: { root: 'bg-highlight-soft' },
        success: { root: 'bg-success-soft' },
        info: { root: 'bg-info-soft' },
        warning: { root: 'bg-warning-soft' },
        error: { root: 'bg-error-soft' },
        neutral: { root: 'bg-elevated' },
      },
    },
  },

  accordion: {
    slots: {
      root: 'w-full',
      item: 'rounded-lg border-0',
      trigger: [
        'min-h-11 gap-2.5 rounded-lg px-3 py-2 text-label font-semibold transition-colors duration-fast',
        'hover:bg-elevated data-[state=open]:bg-elevated aria-expanded:text-highlighted',
        disabledState,
        focusInset,
      ].join(' '),
      content: 'text-body text-toned',
      body: 'px-3 pb-3 pt-2',
      leadingIcon: 'size-5 text-muted',
      trailingIcon: 'size-5 text-muted transition-transform duration-base',
      label: 'text-label',
    },
  },

  dropdownMenu: { slots: menuSlots, variants: { size: menuItemSizes } },

  popover: {
    slots: {
      content: 'z-50 rounded-lg bg-default p-3 text-body shadow-modal ring-0 outline-none',
      arrow: 'fill-default stroke-transparent',
    },
  },

  // Inverse tip: always readable, small, no ring.
  tooltip: {
    slots: {
      content:
        'z-50 rounded-sm bg-inverted px-2.5 py-1.5 text-caption text-inverted shadow-modal ring-0',
      arrow: 'fill-inverted stroke-transparent',
      text: 'text-caption',
    },
  },

  skeleton: { base: 'animate-pulse rounded-md bg-elevated motion-reduce:animate-none' },

  breadcrumb: {
    slots: {
      list: 'gap-1',
      link: [
        'min-h-9 gap-1.5 rounded-sm px-1.5 text-label transition-colors duration-fast',
        'hover:text-highlighted',
        focusRing,
      ].join(' '),
      linkLeadingIcon: 'size-4',
      separatorIcon: 'size-4 text-dimmed',
    },
    variants: {
      active: {
        true: { link: 'font-semibold text-highlighted' },
        false: { link: 'font-medium text-muted' },
      },
    },
  },

  chip: { slots: { base: 'font-semibold tabular-nums' } },

  // Keyboard hint: tonal chip, no ring.
  kbd: {
    base: 'rounded-xs font-sans font-semibold tabular-nums',
    variants: {
      variant: {
        solid: 'bg-inverted text-inverted',
        outline: 'bg-elevated text-toned ring-0',
        subtle: 'bg-elevated text-toned ring-0',
      },
      size: {
        sm: 'h-5 min-w-5 px-1 text-badge',
        md: 'h-6 min-w-6 px-1.5 text-badge',
        lg: 'h-7 min-w-7 px-2 text-caption',
      },
    },
    defaultVariants: { variant: 'subtle', size: 'md' },
  },

  // The stock line is `border-default` (transparent here), so a separator would vanish: use a faint layer colour.
  separator: {
    slots: {
      border: 'border-(--ui-bg-accented)',
      label: 'text-caption text-muted',
      icon: 'size-5 text-dimmed',
    },
  },

  empty: {
    slots: {
      root: 'gap-3 rounded-lg p-6 sm:p-8',
      title: 'text-subheading font-semibold text-highlighted',
      description: 'text-body text-muted',
    },
    defaultVariants: { variant: 'naked' },
    variants: {
      variant: {
        outline: { root: 'bg-default shadow-raised ring-0' },
        soft: { root: 'bg-elevated' },
        subtle: { root: 'bg-elevated ring-0' },
      },
    },
  },

  stepper: {
    slots: {
      trigger: `transition-colors duration-base ${disabledState} ${focusRing}`,
      separator: 'bg-elevated',
      title: 'text-label font-semibold text-highlighted',
      description: 'text-caption text-muted',
    },
  },

  slider: {
    slots: {
      root: `min-h-11 ${disabledState} data-[orientation=vertical]:min-h-0 data-[orientation=vertical]:min-w-11`,
      track: 'bg-accented',
      thumb:
        'bg-default shadow-lift transition-transform duration-fast hover:scale-110 active:scale-95',
    },
  },

  commandPalette: {
    variants: {
      size: Object.fromEntries(
        sizeKeys.map((k) => [k, { ...menuRowSizes, empty: 'px-3 py-8 text-body' }]),
      ),
    },
    slots: {
      root: 'divide-y-0 bg-default',
      content: 'bg-default',
      group: 'p-1.5',
      empty: 'px-3 py-8 text-body text-muted',
      label: 'px-3 py-2 text-overline text-muted',
      item,
      itemLeadingIcon: 'size-5 text-muted',
      itemLabelBase: 'text-highlighted [&>mark]:bg-primary-soft [&>mark]:text-primary-t',
      itemLabelPrefix: 'text-default',
      itemLabelSuffix: 'text-dimmed [&>mark]:bg-primary-soft [&>mark]:text-primary-t',
      itemDescription: 'text-caption text-muted',
      footer: 'p-1.5',
    },
  },

  collapsible: {
    slots: {
      trigger: [
        'min-h-11 gap-2 rounded-md px-2 text-label font-semibold transition-colors duration-fast',
        'hover:bg-elevated data-[state=open]:text-highlighted',
        disabledState,
        focusRing,
      ].join(' '),
      content: 'text-body',
    },
  },

  // Dropzone: a tonal block, no dashed line; dragging tints it, an invalid drop shows the error fill.
  fileUpload: {
    slots: {
      base: [
        'rounded-lg border-0 bg-elevated p-6 ring-0 transition-colors duration-base',
        'hover:bg-accented data-[dragging=true]:bg-primary-soft aria-invalid:bg-error-field',
        disabledState,
        focusRing,
      ].join(' '),
      label: 'text-label font-semibold',
      description: 'text-caption text-muted',
      fileName: 'text-label',
      fileSize: 'text-caption',
    },
  },

  link: {
    base: `rounded-xs transition-colors duration-fast ${focusRing}`,
    variants: { disabled: { true: 'cursor-not-allowed opacity-(--ds-disabled-opacity)' } },
  },
}
