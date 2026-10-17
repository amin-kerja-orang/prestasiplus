<script setup lang="ts">
/**
 * Responsive data table shell (restyle spec 1.4): a raised card, zebra rows, no lines. From `md` the
 * `<table>` scrolls inside its own card when it is wider than the card; below `md` every row becomes a
 * card and each `CardCell` prints its `label` before the value. One DOM for both layouts (rows keep their
 * test ids and handlers). Strict page files may not use raw table elements, so they compose
 * `CardTable` > `CardRow` > `CardCell`. Slots: `default` (the body rows), `header` / `footer` (card strips)
 * and `head-<key>` (custom header cell content, e.g. a select-all checkbox).
 */
export interface CardTableColumn {
  key: string
  label: string
}

defineProps<{
  columns: readonly CardTableColumn[]
  /** Visually hidden caption. */
  caption?: string
}>()
</script>

<template>
  <div class="min-w-0 rounded-card bg-default shadow-card" data-ds="card-table">
    <slot name="header" />
    <div class="card-table max-w-full overflow-x-auto">
      <table>
        <caption v-if="caption" class="sr-only">
          {{ caption }}
        </caption>
        <thead>
          <tr>
            <th v-for="c in columns" :key="c.key" scope="col">
              <slot :name="`head-${c.key}`">{{ c.label }}</slot>
            </th>
          </tr>
        </thead>
        <tbody>
          <slot />
        </tbody>
      </table>
    </div>
    <slot name="footer" />
  </div>
</template>

<style scoped>
.card-table :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}
.card-table :deep(th) {
  padding: calc(var(--spacing) * 3);
  text-align: start;
  color: var(--ui-text-muted);
  font-size: var(--text-overline);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.card-table :deep(td) {
  padding: calc(var(--spacing) * 3);
  vertical-align: middle;
}
.card-table :deep(tbody tr:nth-child(even)) {
  background: var(--ui-bg-muted);
}
@media (max-width: 47.99rem) {
  .card-table :deep(table),
  .card-table :deep(tbody),
  .card-table :deep(tr),
  .card-table :deep(td) {
    display: block;
  }
  .card-table :deep(thead) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .card-table :deep(tbody tr) {
    margin: calc(var(--spacing) * 3);
    padding: calc(var(--spacing) * 2);
    border-radius: var(--radius-card);
    background: var(--ui-bg-muted);
  }
  .card-table :deep(td) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(var(--spacing) * 3);
    min-height: calc(var(--spacing) * 11);
    padding: calc(var(--spacing) * 1) calc(var(--spacing) * 2);
    text-align: end;
  }
  .card-table :deep(td[data-label])::before {
    content: attr(data-label);
    flex-shrink: 0;
    color: var(--ui-text-muted);
    font-size: var(--text-caption);
    text-align: start;
  }
  .card-table :deep(td[colspan]) {
    display: block;
    text-align: center;
  }
}
</style>
