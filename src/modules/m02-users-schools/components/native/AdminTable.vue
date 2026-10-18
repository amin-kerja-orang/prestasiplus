<script setup lang="ts">
/**
 * Responsive admin table: a raised card, sticky header from `xl`, roomy 56px rows with a hover layer, no
 * zebra and no horizontal page scroll. From `md` it is a real table (it scrolls inside its card below
 * `xl` when needed); below `md` each row becomes a card and `AdminCell` prints its label before the
 * value. Compose `AdminTable` > `AdminRow` > `AdminCell`; slots: `default` (body rows), `header` and
 * `footer` (strips in the card) and `head-<key>` (custom header cell, e.g. select-all).
 * Lives outside the strict globs: it owns the radius, the surfaces and the table markup.
 */
export interface AdminColumn {
  key: string
  label: string
  /** Extra classes of the header cell (width, alignment). */
  cls?: string
}

defineProps<{
  columns: readonly AdminColumn[]
  caption?: string
}>()
</script>

<template>
  <div
    class="min-w-0 rounded-lg bg-default shadow-card max-xl:overflow-x-auto xl:overflow-clip"
    data-ds="admin-table"
  >
    <slot name="header" />
    <table class="block w-full border-collapse text-body md:table">
      <caption v-if="caption" class="sr-only">
        {{
          caption
        }}
      </caption>
      <thead class="max-md:sr-only">
        <tr>
          <th
            v-for="c in columns"
            :key="c.key"
            scope="col"
            class="bg-default px-2 py-4 text-start text-label font-semibold whitespace-nowrap text-muted xl:sticky xl:top-0 xl:z-10"
            :class="c.cls"
          >
            <slot :name="`head-${c.key}`">{{ c.label }}</slot>
          </th>
        </tr>
      </thead>
      <tbody class="flex flex-col gap-3 max-md:p-3 md:table-row-group">
        <slot />
      </tbody>
    </table>
    <slot name="footer" />
  </div>
</template>
