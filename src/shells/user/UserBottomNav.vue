<script setup lang="ts">
/**
 * Mobile bottom navigation (< lg), live `nav.bottom-nav`: Home, SPM, Game, Topik links, then the
 * "Chat" and "Lagi" buttons. Live "Chat" dispatches `toggle-chatbot` (the chatbot widget is M22,
 * not built: the event has no listener yet, so the button is inert). Live "Lagi" dispatches
 * `toggle-drawer`, i.e. it opens the same drawer as the header hamburger.
 */
import { computed } from 'vue'

import { userBottomNavFor, bottomNavActive } from '@/shells/nav/user-nav'
import NavIcon from '@/shells/shared/NavIcon.vue'
import ShellLink from '@/shells/shared/ShellLink.vue'
import { useSessionStore } from '@/stores/session'

defineProps<{ currentPath: string }>()

const session = useSessionStore()
// Prototype scope (D43): link tabs outside the role's allowed set are not rendered.
const tabs = computed(() => userBottomNavFor(session.role))

const emit = defineEmits<{ 'toggle-drawer': [] }>()

function onButton(id: 'chat' | 'lagi'): void {
  if (id === 'lagi') emit('toggle-drawer')
  else if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('toggle-chatbot'))
}

const ITEM = 'mobile-nav-item flex flex-col items-center justify-center flex-1 py-2'
const ICON = 'text-lg sm:text-xl mb-0.5 sm:mb-1'
</script>

<template>
  <nav
    class="bottom-nav fixed right-0 bottom-0 left-0 z-50 pb-[env(safe-area-inset-bottom)] lg:hidden"
    data-testid="shell-user-bottom-nav"
  >
    <div class="flex h-14 items-center justify-around px-1 sm:h-16 sm:px-2">
      <template v-for="entry in tabs" :key="entry.id">
        <ShellLink
          v-if="entry.kind === 'link'"
          :to="entry.to"
          :class="[ITEM, { active: bottomNavActive(entry, currentPath) }]"
          :data-nav-id="`bottom-${entry.id}`"
        >
          <NavIcon :fa="entry.fa" :class="ICON" :style="entry.iconStyle" />
          <span class="text-[9px] font-bold sm:text-xs">{{ entry.label }}</span>
        </ShellLink>
        <button
          v-else
          type="button"
          :class="ITEM"
          :data-nav-id="`bottom-${entry.id}`"
          @click="onButton(entry.id)"
        >
          <NavIcon :fa="entry.fa" :class="ICON" :style="entry.iconStyle" />
          <span class="text-[9px] font-bold sm:text-xs">{{ entry.label }}</span>
        </button>
      </template>
    </div>
  </nav>
</template>
