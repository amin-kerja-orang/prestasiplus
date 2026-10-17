/**
 * Phosphor icons of the M08 performance pages (regular for staff, duotone for the learner). The icon
 * bundler only finds literal `i-ph-*` strings, so every name is spelled out here, once.
 */
import { computed, type ComputedRef } from 'vue'

import { usePersonality } from '@/ds'

const ICONS = {
  'arrow-left': ['i-ph-arrow-left', 'i-ph-arrow-left-duotone'],
  'arrow-right': ['i-ph-arrow-right', 'i-ph-arrow-right-duotone'],
  'arrow-square-out': ['i-ph-arrow-square-out', 'i-ph-arrow-square-out-duotone'],
  barbell: ['i-ph-barbell', 'i-ph-barbell-duotone'],
  brain: ['i-ph-brain', 'i-ph-brain-duotone'],
  buildings: ['i-ph-buildings', 'i-ph-buildings-duotone'],
  'calendar-dots': ['i-ph-calendar-dots', 'i-ph-calendar-dots-duotone'],
  'caret-down': ['i-ph-caret-down', 'i-ph-caret-down-duotone'],
  'caret-right': ['i-ph-caret-right', 'i-ph-caret-right-duotone'],
  'caret-up': ['i-ph-caret-up', 'i-ph-caret-up-duotone'],
  chalkboard: ['i-ph-chalkboard', 'i-ph-chalkboard-duotone'],
  'chalkboard-teacher': ['i-ph-chalkboard-teacher', 'i-ph-chalkboard-teacher-duotone'],
  'chart-bar': ['i-ph-chart-bar', 'i-ph-chart-bar-duotone'],
  'chart-line-up': ['i-ph-chart-line-up', 'i-ph-chart-line-up-duotone'],
  'chart-pie': ['i-ph-chart-pie', 'i-ph-chart-pie-duotone'],
  'check-circle': ['i-ph-check-circle', 'i-ph-check-circle-duotone'],
  clock: ['i-ph-clock', 'i-ph-clock-duotone'],
  'clipboard-text': ['i-ph-clipboard-text', 'i-ph-clipboard-text-duotone'],
  fire: ['i-ph-fire', 'i-ph-fire-duotone'],
  funnel: ['i-ph-funnel', 'i-ph-funnel-duotone'],
  'graduation-cap': ['i-ph-graduation-cap', 'i-ph-graduation-cap-duotone'],
  'hand-heart': ['i-ph-hand-heart', 'i-ph-hand-heart-duotone'],
  info: ['i-ph-info', 'i-ph-info-duotone'],
  lightbulb: ['i-ph-lightbulb', 'i-ph-lightbulb-duotone'],
  lightning: ['i-ph-lightning', 'i-ph-lightning-duotone'],
  'list-numbers': ['i-ph-list-numbers', 'i-ph-list-numbers-duotone'],
  'map-trifold': ['i-ph-map-trifold', 'i-ph-map-trifold-duotone'],
  medal: ['i-ph-medal', 'i-ph-medal-duotone'],
  minus: ['i-ph-minus', 'i-ph-minus-duotone'],
  play: ['i-ph-play', 'i-ph-play-duotone'],
  question: ['i-ph-question', 'i-ph-question-duotone'],
  star: ['i-ph-star', 'i-ph-star-duotone'],
  target: ['i-ph-target', 'i-ph-target-duotone'],
  tray: ['i-ph-tray', 'i-ph-tray-duotone'],
  'trend-down': ['i-ph-trend-down', 'i-ph-trend-down-duotone'],
  'trend-up': ['i-ph-trend-up', 'i-ph-trend-up-duotone'],
  'user-minus': ['i-ph-user-minus', 'i-ph-user-minus-duotone'],
  users: ['i-ph-users', 'i-ph-users-duotone'],
  warning: ['i-ph-warning', 'i-ph-warning-duotone'],
  books: ['i-ph-books', 'i-ph-books-duotone'],
  user: ['i-ph-user', 'i-ph-user-duotone'],
  smiley: ['i-ph-smiley', 'i-ph-smiley-duotone'],
  'smiley-meh': ['i-ph-smiley-meh', 'i-ph-smiley-meh-duotone'],
  'smiley-sad': ['i-ph-smiley-sad', 'i-ph-smiley-sad-duotone'],
} as const

export type PhIcon = keyof typeof ICONS

/** Returns a resolver `icon('users')` -> the class for the active personality. */
export function usePhIcon(): ComputedRef<(name: PhIcon) => string> {
  const personality = usePersonality()
  return computed(() => (name: PhIcon) => ICONS[name][personality.value === 'learner' ? 1 : 0])
}
