<script setup lang="ts">
/**
 * Renders the shared user menu (DV-SH-04) on one surface with the live markup of that surface:
 * the desktop sidebar (`.nav-item`, `text-lg` icons) or the mobile drawer (`.drawer-nav-item`,
 * 9px pills, `.drawer-section-label`). Entries come already filtered by role (`navFor`).
 */
import { reactive } from 'vue'

import {
  drawerBadgeClass,
  isActivePath,
  type NavEntry,
  type NavItem,
  type NavSurface,
} from '@/shells/nav/user-nav'
import { useNavBadgeText } from '@/shells/user/nav-badges'
import NavIcon from '@/shells/shared/NavIcon.vue'
import ShellLink from '@/shells/shared/ShellLink.vue'

const props = defineProps<{
  entries: readonly NavEntry[]
  surface: NavSurface
  currentPath: string
}>()

/** Collapsible groups (live Alpine `kirkGuruOpen: false`, not persisted). */
const openGroups = reactive<Record<string, boolean>>({})

const badgeText = useNavBadgeText()

const isDrawer = () => props.surface === 'drawer'

function active(item: NavItem): boolean {
  return isActivePath(props.currentPath, item.to)
}

function badgeClass(item: NavItem): string {
  if (!item.badge) return ''
  return isDrawer() ? drawerBadgeClass(item.badge.cls) : item.badge.cls
}

/** Main items: sidebar `.nav-item` + `text-lg` icon; drawer `.drawer-nav-item`. */
function mainClass(): string {
  return isDrawer() ? 'drawer-nav-item' : 'nav-item flex items-center space-x-3'
}

function mainIconClass(item: NavItem): string {
  return isDrawer() ? `w-5 text-center ${item.color}` : `w-5 text-center text-lg ${item.color}`
}

const PUSAT_AI_TITLE_STYLE =
  'background: linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899); -webkit-background-clip: text; background-clip: text; color: transparent;'
</script>

<template>
  <template v-for="entry in entries" :key="entry.id">
    <!-- Pusat AI header: one live partial, same markup on both surfaces -->
    <div v-if="entry.kind === 'section' && entry.variant === 'gradient'" class="pt-4 pb-2">
      <div class="flex items-center gap-2 px-3">
        <span class="text-xs font-extrabold tracking-wider uppercase" :style="PUSAT_AI_TITLE_STYLE">
          {{ entry.label }}
        </span>
        <div :class="`h-[2px] flex-1 bg-gradient-to-r ${entry.rule} rounded-full to-transparent`" />
        <span v-if="entry.badge" :class="entry.badge.cls">{{ entry.badge.text }}</span>
      </div>
    </div>

    <!-- Section header -->
    <div
      v-else-if="entry.kind === 'section' && surface === 'drawer'"
      class="drawer-section-label"
      :data-nav-id="entry.id"
    >
      <div class="flex items-center gap-2">
        <span :class="entry.text">{{ entry.label }}</span>
        <div :class="`h-[2px] flex-1 bg-gradient-to-r ${entry.rule} rounded-full to-transparent`" />
      </div>
    </div>
    <div
      v-else-if="entry.kind === 'section'"
      :class="entry.wrap ?? 'pt-4 pb-2'"
      :data-nav-id="entry.id"
    >
      <div class="flex items-center gap-2 px-3">
        <span :class="`text-xs font-extrabold ${entry.text} tracking-wider uppercase`">
          {{ entry.label }}
        </span>
        <div :class="`h-[2px] flex-1 bg-gradient-to-r ${entry.rule} rounded-full to-transparent`" />
      </div>
    </div>

    <!-- Pusat AI sub-heading -->
    <div v-else-if="entry.kind === 'subheading'" class="px-3 pt-3 pb-1" :data-nav-id="entry.id">
      <span :class="entry.cls">{{ entry.label }}</span>
    </div>

    <!-- Collapsible group (drawer "Kirkpatrick" markup, used on both surfaces) -->
    <div v-else-if="entry.kind === 'group'" :data-nav-id="entry.id">
      <button
        type="button"
        class="drawer-nav-item flex w-full items-center justify-between"
        @click="openGroups[entry.id] = !openGroups[entry.id]"
      >
        <span class="flex items-center">
          <NavIcon :fa="entry.fa" :class="`w-5 text-center ${entry.color}`" />
          <span class="ml-3">{{ entry.label }}</span>
        </span>
        <NavIcon
          fa="fa-chevron-down"
          class="text-xs transition-transform"
          :class="openGroups[entry.id] && 'rotate-180'"
        />
      </button>
      <div v-show="openGroups[entry.id]" class="mt-1 ml-6 space-y-0.5">
        <ShellLink
          v-for="child in entry.children"
          :key="child.id"
          :to="child.to"
          class="drawer-nav-item text-sm"
          :class="{ active: active(child) }"
          :data-nav-id="child.id"
        >
          <NavIcon :fa="child.fa" class="w-4 text-xs" /> <span class="ml-2">{{ child.label }}</span>
        </ShellLink>
      </div>
    </div>

    <!-- Command Center card -->
    <ShellLink
      v-else-if="entry.kind === 'item' && entry.variant === 'command'"
      :to="entry.to"
      :target="entry.target"
      class="mb-3 flex items-center space-x-3 rounded-xl px-4 py-3 shadow-[0_4px_15px_rgba(99,102,241,0.3)] bg-command-gradient"
      :data-nav-id="entry.id"
    >
      <NavIcon :fa="entry.fa" :class="`w-5 text-center ${entry.color}`" />
      <span class="text-sm font-bold text-white">{{ entry.label }}</span>
      <span v-if="entry.badge" :class="entry.badge.cls">{{ entry.badge.text }}</span>
    </ShellLink>

    <!-- "Ke Admin Panel" -->
    <ShellLink
      v-else-if="entry.kind === 'item' && entry.variant === 'admin-link' && surface === 'drawer'"
      :to="entry.to"
      class="drawer-nav-item mb-1 rounded-lg bg-indigo-50 font-bold text-indigo-700"
      :data-nav-id="entry.id"
    >
      <NavIcon :fa="entry.fa" :class="`w-5 text-center ${entry.color}`" />
      <span>{{ entry.label }}</span>
    </ShellLink>
    <ShellLink
      v-else-if="entry.kind === 'item' && entry.variant === 'admin-link'"
      :to="entry.to"
      class="nav-item mb-1 flex items-center space-x-3 rounded-lg bg-indigo-50 hover:bg-indigo-100"
      :data-nav-id="entry.id"
    >
      <NavIcon :fa="entry.fa" :class="`w-5 text-center text-lg ${entry.color}`" />
      <span class="font-semibold text-indigo-700">{{ entry.label }}</span>
    </ShellLink>

    <!-- Pusat AI partial item: same markup on both surfaces -->
    <ShellLink
      v-else-if="entry.kind === 'item' && entry.variant === 'ai'"
      :to="entry.to"
      class="nav-item flex items-center space-x-3"
      :class="{ active: active(entry) }"
      :data-tip="entry.tip"
      :data-nav-id="entry.id"
    >
      <NavIcon :fa="entry.fa" :class="`w-5 text-center ${entry.color}`" />
      <span class="text-sm font-semibold">{{ entry.label }}</span>
      <span v-if="entry.badge" :class="entry.badge.cls">{{ entry.badge.text }}</span>
    </ShellLink>

    <!-- Live sidebar item rendered with the drawer classes (Audio KBAT) -->
    <ShellLink
      v-else-if="entry.kind === 'item' && entry.variant === 'drawer-style'"
      :to="entry.to"
      class="drawer-nav-item"
      :class="{ active: active(entry) }"
      :data-nav-id="entry.id"
    >
      <NavIcon :fa="entry.fa" :class="`w-5 text-center ${entry.color}`" />
      <span>{{ entry.label }}</span>
    </ShellLink>

    <!-- Main item -->
    <ShellLink
      v-else-if="entry.kind === 'item'"
      :to="entry.to"
      :class="[mainClass(), { active: active(entry) }]"
      :data-tip="surface === 'sidebar' ? entry.tip : undefined"
      :data-nav-id="entry.id"
    >
      <NavIcon :fa="entry.fa" :class="mainIconClass(entry)" />
      <span :class="surface === 'sidebar' ? 'font-semibold' : undefined">{{ entry.label }}</span>
      <span v-if="entry.badge" :class="badgeClass(entry)">{{
        badgeText(entry.id, entry.badge.text)
      }}</span>
    </ShellLink>
  </template>
</template>
