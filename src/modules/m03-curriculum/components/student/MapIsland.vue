<script setup lang="ts">
/**
 * One S14 island node (M03-T4; FR-M03-85..88). Starts at opacity 0 / translateY(30px) and fades in
 * (0.5 s, delay index x 0.1 s) when it enters the viewport (IntersectionObserver, threshold 0.1),
 * exactly as live and with no reduced-motion handling (D10). Without IntersectionObserver the node
 * is shown at once.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import type { LearningMapTopic } from '../../api/student-curriculum'
import { ISLAND_LABEL, practiceHref, sessionsLine } from '../../lib/student-catalogue'
import { DsCluster, DsHeading } from '@/ds'

defineProps<{ topic: LearningMapTopic; index: number }>()

const node = ref<HTMLElement | null>(null)
const visible = ref(typeof IntersectionObserver === 'undefined')
let observer: IntersectionObserver | null = null

onMounted(() => {
  if (visible.value || !node.value) return
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        visible.value = true
        observer?.disconnect()
      }
    },
    { threshold: 0.1 },
  )
  observer.observe(node.value)
})
onBeforeUnmount(() => observer?.disconnect())

const CARD: Record<string, string> = {
  mastered: 'bg-default',
  started: 'bg-default',
  unlocked: 'bg-default ring-2 ring-heat',
  locked: 'cursor-not-allowed bg-elevated opacity-70',
}
const LABEL: Record<string, string> = {
  mastered: 'text-success',
  started: 'text-primary-t',
  unlocked: 'text-heat',
  locked: 'text-muted',
}
const TILE: Record<string, string> = {
  mastered: 'bg-success text-on-sem',
  started: 'bg-primary text-primary-on',
  unlocked: 'bg-heat text-on-highlight',
  locked: 'bg-accented text-default',
}
</script>

<template>
  <div
    ref="node"
    class="relative mx-auto w-full max-w-md transition-all duration-500 ease-out md:w-5/12 md:max-w-none"
    :class="[index % 2 === 0 ? 'md:ms-auto' : 'md:me-auto', visible ? 'opacity-100' : 'opacity-0']"
    :data-state="topic.state"
    :data-visible="visible ? 'true' : 'false'"
    data-testid="map-node"
  >
    <component
      :is="topic.state === 'locked' ? 'div' : RouterLink"
      v-bind="topic.state === 'locked' ? {} : { to: practiceHref(topic.id) }"
      class="block rounded-card p-4 shadow-lift"
      :class="CARD[topic.state]"
      data-testid="island"
    >
      <DsCluster :wrap="false">
        <span
          class="flex size-12 shrink-0 items-center justify-center rounded-2xl text-heading"
          :class="TILE[topic.state]"
          data-testid="island-emoji"
        >
          <template v-if="topic.state === 'locked'">🔒</template>
          <template v-else>{{ topic.icon ?? '' }}</template>
        </span>
        <div class="min-w-0 flex-1">
          <div class="text-overline" :class="LABEL[topic.state]" data-testid="island-label">
            {{ ISLAND_LABEL[topic.state] }}
          </div>
          <DsHeading :level="3" wrap="anywhere" data-testid="island-name">
            {{ topic.name }}
          </DsHeading>
        </div>
      </DsCluster>
      <p v-if="topic.state === 'locked'" class="mt-3 text-body text-muted">
        Selesaikan topik sebelumnya dulu
      </p>
      <template v-else>
        <div class="mt-3 flex items-center gap-2">
          <UProgress
            :model-value="topic.progress"
            size="sm"
            class="flex-1"
            data-testid="island-bar"
          />
          <span class="text-caption font-bold text-default" data-testid="island-progress">
            {{ topic.progress }}%
          </span>
        </div>
        <p class="mt-2 text-caption text-muted" data-testid="island-sessions">
          {{ sessionsLine(topic.sessions, topic.questionsAnswered) }}
        </p>
      </template>
    </component>
  </div>
</template>
