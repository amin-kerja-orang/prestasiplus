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
  mastered: 'border-emerald-400 bg-gradient-to-br from-emerald-50 to-green-100',
  started: 'border-blue-400 bg-gradient-to-br from-blue-50 to-sky-100',
  unlocked: 'island-glow border-amber-400 bg-gradient-to-br from-amber-50 to-yellow-100',
  locked: 'cursor-not-allowed border-slate-300 bg-gradient-to-br from-slate-100 to-slate-200 opacity-60',
}
const LABEL: Record<string, string> = {
  mastered: 'text-emerald-600',
  started: 'text-blue-600',
  unlocked: 'text-amber-600',
  locked: 'text-slate-500',
}
const TILE: Record<string, string> = {
  mastered: 'bg-emerald-200',
  started: 'bg-blue-200',
  unlocked: 'bg-amber-200',
  locked: 'bg-slate-300',
}
</script>

<template>
  <div
    ref="node"
    class="relative w-full max-w-md transition-all duration-500 ease-out mx-auto min-[769px]:w-[45%] min-[769px]:max-w-none"
    :class="[
      index % 2 === 0 ? 'min-[769px]:mr-0 min-[769px]:ml-auto' : 'min-[769px]:mr-auto min-[769px]:ml-0',
      visible ? 'translate-y-0 opacity-100' : 'translate-y-[30px] opacity-0',
    ]"
    :style="{ transitionDelay: `${String(index * 0.1)}s` }"
    :data-state="topic.state"
    :data-visible="visible ? 'true' : 'false'"
    data-testid="map-node"
  >
    <component
      :is="topic.state === 'locked' ? 'div' : RouterLink"
      v-bind="topic.state === 'locked' ? {} : { to: practiceHref(topic.id) }"
      class="block rounded-3xl border-2 p-4 shadow"
      :class="CARD[topic.state]"
      data-testid="island"
    >
      <div class="flex items-center gap-3">
        <span
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl"
          :class="TILE[topic.state]"
          data-testid="island-emoji"
        >
          <template v-if="topic.state === 'locked'">🔒</template>
          <template v-else>{{ topic.icon ?? '' }}</template>
        </span>
        <div class="min-w-0 flex-1">
          <div class="text-xs font-bold tracking-wide" :class="LABEL[topic.state]" data-testid="island-label">
            {{ ISLAND_LABEL[topic.state] }}
          </div>
          <h3 class="font-heading text-base font-bold break-words text-slate-800" data-testid="island-name">
            {{ topic.name }}
          </h3>
        </div>
      </div>
      <p v-if="topic.state === 'locked'" class="mt-3 text-sm text-slate-500">
        Selesaikan topik sebelumnya dulu
      </p>
      <template v-else>
        <div class="mt-3 flex items-center gap-2">
          <div class="h-2 flex-1 overflow-hidden rounded-full bg-white/80">
            <div
              class="h-full rounded-full bg-blue-500"
              :style="{ width: `${String(topic.progress)}%` }"
              data-testid="island-bar"
            ></div>
          </div>
          <span class="text-xs font-bold text-slate-600" data-testid="island-progress">
            {{ topic.progress }}%
          </span>
        </div>
        <p class="mt-2 text-xs text-slate-600" data-testid="island-sessions">
          {{ sessionsLine(topic.sessions, topic.questionsAnswered) }}
        </p>
      </template>
    </component>
  </div>
</template>

<style scoped>
.island-glow {
  animation: pulse-glow 2s ease-in-out infinite;
}
@keyframes pulse-glow {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgb(251 191 36 / 0.4);
  }
  50% {
    box-shadow: 0 0 0 10px rgb(251 191 36 / 0);
  }
}
</style>
