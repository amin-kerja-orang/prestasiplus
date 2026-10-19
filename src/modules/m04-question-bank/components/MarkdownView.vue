<script setup lang="ts">
/**
 * Renders the Markdown of the stored AI explanation with the `.prose-ai` styles (FR-M04-45:
 * headings, lists, tables, code). The text is parsed to a tree (`lib/markdown.ts`) and drawn with
 * template interpolation, so Vue escapes every character: no HTML from the explanation is ever
 * inserted as markup.
 */
import { computed } from 'vue'

import { DsProse } from '@/ds'

import { parseMarkdown } from '../lib/markdown'

const props = defineProps<{ source: string }>()
const blocks = computed(() => parseMarkdown(props.source))

const HEADING_TAGS = { 1: 'h1', 2: 'h2', 3: 'h3', 4: 'h4' } as const
</script>

<template>
  <DsProse class="text-body text-default">
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

      <div v-else-if="block.kind === 'table'" class="max-w-full overflow-x-auto">
        <table>
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
      </div>

      <pre v-else><code>{{ block.text }}</code></pre>
    </template>
  </DsProse>
</template>
