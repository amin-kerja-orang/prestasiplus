<script setup lang="ts">
/**
 * Renders the Markdown of the stored AI explanation with the `.prose-ai` styles (FR-M04-45:
 * headings, lists, tables, code). The text is parsed to a tree (`lib/markdown.ts`) and drawn with
 * template interpolation, so Vue escapes every character: no HTML from the explanation is ever
 * inserted as markup.
 */
import { computed } from 'vue'

import { parseMarkdown } from '../lib/markdown'

const props = defineProps<{ source: string }>()
const blocks = computed(() => parseMarkdown(props.source))

const HEADING_TAGS = { 1: 'h1', 2: 'h2', 3: 'h3', 4: 'h4' } as const
</script>

<template>
  <div class="prose-ai text-sm text-slate-700">
    <template v-for="(block, b) in blocks" :key="b">
      <component :is="HEADING_TAGS[block.level]" v-if="block.kind === 'heading'">
        <template v-for="(part, p) in block.content" :key="p">
          <code v-if="part.kind === 'code'">{{ part.text }}</code>
          <strong v-else-if="part.kind === 'strong'">{{ part.text }}</strong>
          <em v-else-if="part.kind === 'em'">{{ part.text }}</em>
          <template v-else>{{ part.text }}</template>
        </template>
      </component>

      <p v-else-if="block.kind === 'paragraph'">
        <template v-for="(line, l) in block.lines" :key="l">
          <br v-if="l > 0" />
          <template v-for="(part, p) in line" :key="p">
            <code v-if="part.kind === 'code'">{{ part.text }}</code>
            <strong v-else-if="part.kind === 'strong'">{{ part.text }}</strong>
            <em v-else-if="part.kind === 'em'">{{ part.text }}</em>
            <template v-else>{{ part.text }}</template>
          </template>
        </template>
      </p>

      <component :is="block.ordered ? 'ol' : 'ul'" v-else-if="block.kind === 'list'">
        <li v-for="(item, n) in block.items" :key="n">
          <template v-for="(part, p) in item" :key="p">
            <code v-if="part.kind === 'code'">{{ part.text }}</code>
            <strong v-else-if="part.kind === 'strong'">{{ part.text }}</strong>
            <em v-else-if="part.kind === 'em'">{{ part.text }}</em>
            <template v-else>{{ part.text }}</template>
          </template>
        </li>
      </component>

      <table v-else-if="block.kind === 'table'">
        <thead>
          <tr>
            <th v-for="(cell, c) in block.head" :key="c">
              <template v-for="(part, p) in cell" :key="p">
                <code v-if="part.kind === 'code'">{{ part.text }}</code>
                <strong v-else-if="part.kind === 'strong'">{{ part.text }}</strong>
                <em v-else-if="part.kind === 'em'">{{ part.text }}</em>
                <template v-else>{{ part.text }}</template>
              </template>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, r) in block.rows" :key="r">
            <td v-for="(cell, c) in row" :key="c">
              <template v-for="(part, p) in cell" :key="p">
                <code v-if="part.kind === 'code'">{{ part.text }}</code>
                <strong v-else-if="part.kind === 'strong'">{{ part.text }}</strong>
                <em v-else-if="part.kind === 'em'">{{ part.text }}</em>
                <template v-else>{{ part.text }}</template>
              </template>
            </td>
          </tr>
        </tbody>
      </table>

      <pre v-else><code>{{ block.text }}</code></pre>
    </template>
  </div>
</template>

<style scoped>
.prose-ai h1,
.prose-ai h2,
.prose-ai h3,
.prose-ai h4 {
  margin: 0.75rem 0 0.375rem;
  font-weight: 700;
  color: var(--color-slate-800);
}
.prose-ai h2 {
  font-size: 1rem;
}
.prose-ai h3 {
  font-size: 0.9375rem;
}
.prose-ai p {
  margin: 0.375rem 0;
}
.prose-ai ul {
  margin: 0.375rem 0;
  padding-left: 1.25rem;
  list-style: disc;
}
.prose-ai ol {
  margin: 0.375rem 0;
  padding-left: 1.25rem;
  list-style: decimal;
}
.prose-ai code {
  border-radius: 0.25rem;
  background: var(--color-slate-100);
  padding: 0.05rem 0.3rem;
  font-size: 0.8125rem;
}
.prose-ai pre {
  margin: 0.5rem 0;
  overflow-x: auto;
  border-radius: 0.5rem;
  background: var(--color-slate-100);
  padding: 0.75rem;
}
.prose-ai table {
  display: block;
  max-width: 100%;
  margin: 0.5rem 0;
  overflow-x: auto;
  border-collapse: collapse;
}
.prose-ai th,
.prose-ai td {
  border: 1px solid var(--color-slate-200);
  padding: 0.375rem 0.625rem;
  text-align: left;
}
.prose-ai th {
  background: var(--color-slate-50);
  font-weight: 700;
}
</style>
