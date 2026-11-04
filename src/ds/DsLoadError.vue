<script setup lang="ts">
/**
 * Load error (design language 10): subtle error alert, warning icon, message and a tonal
 * "Cuba Semula" button. One component for the 11 module copies of `LoadError`/`ErrorBox`.
 * `inline` is the compact one-line form for use inside a panel.
 *
 * When `error` is a `RATE_LIMITED` `ApiError` (40 ERR-RATE-01 / X10.11.5), the message becomes
 * "Terlalu banyak percubaan. Sila cuba sebentar lagi." plus a live countdown ("Cuba lagi dalam
 * {s} saat.", or "{m} minit" from 120 s); the retry button stays disabled until it reaches 0.
 */
import { computed, onUnmounted, ref, watch } from 'vue'

import { API_ERROR_CODES, isApiError } from '@/api/errors'

import { dsCopy } from './copy'

const props = withDefaults(
  defineProps<{
    message?: string
    title?: string
    retryLabel?: string
    /** `alert` = full alert; `inline` = one line inside a panel. */
    variant?: 'alert' | 'inline'
    /** @deprecated use `variant="inline"`. */
    inline?: boolean
    /** The retry is running. */
    loading?: boolean
    testid?: string
    /** `data-testid` of the retry button. */
    retryTestid?: string
    /**
     * The caught error. When it is a `RATE_LIMITED` `ApiError` the component shows ERR-RATE-01
     * with a countdown; any other value (or none) leaves the render exactly as before.
     */
    error?: unknown
  }>(),
  {
    message: dsCopy.loadError,
    title: undefined,
    retryLabel: dsCopy.retry,
    variant: undefined,
    inline: false,
    loading: false,
    testid: undefined,
    retryTestid: undefined,
    error: undefined,
  },
)

const isInline = computed(() => (props.variant ?? (props.inline ? 'inline' : 'alert')) === 'inline')

const emit = defineEmits<{ retry: [] }>()

/** The rate-limited error, or `null` for every other case (then the render is unchanged). */
const rateLimited = computed(() =>
  isApiError(props.error, API_ERROR_CODES.RATE_LIMITED) ? props.error : null,
)

/** Seconds left on the countdown; drives both the copy and the disabled button. */
const remaining = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

function stop() {
  if (timer !== undefined) {
    clearInterval(timer)
    timer = undefined
  }
}

function start() {
  stop()
  const err = rateLimited.value
  if (err === null) {
    remaining.value = 0
    return
  }
  // body `retryAfter` then header are already resolved in errors.ts; else 30 s. Clamped to 1..120 s, whole seconds.
  const seconds = Math.min(120, Math.max(1, Math.ceil(err.retryAfter ?? 30)))
  // Deadline based, so a throttled background tab shows the right value when its timer finally fires.
  const deadline = Date.now() + seconds * 1000
  remaining.value = seconds
  timer = setInterval(() => {
    remaining.value = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
    if (remaining.value <= 0) stop()
  }, 1000)
}

// Restart the countdown whenever the error changes; clean up on unmount.
watch(() => props.error, start, { immediate: true })
onUnmounted(stop)

/** "Cuba lagi dalam {s} saat." / "{m} minit" (ceil) from 120 s; empty once it reaches 0. */
const countdownText = computed(() => {
  if (rateLimited.value === null || remaining.value <= 0) return ''
  if (remaining.value >= 120) return `Cuba lagi dalam ${String(Math.ceil(remaining.value / 60))} minit.`
  return `Cuba lagi dalam ${String(remaining.value)} saat.`
})

const RATE_LIMITED_TEXT = 'Terlalu banyak percubaan. Sila cuba sebentar lagi.'

/** The retry is blocked while the countdown runs. */
const retryDisabled = computed(() => rateLimited.value !== null && remaining.value > 0)

/** Alert heading: the ERR-RATE-01 lead for a rate limit, else the usual title/message. */
const alertTitle = computed(() =>
  rateLimited.value !== null ? RATE_LIMITED_TEXT : (props.title ?? props.message),
)

/** Alert body: the countdown for a rate limit, else the existing description behaviour. */
const alertDescription = computed(() => {
  if (rateLimited.value !== null) return undefined // the countdown renders in the description slot (aria-live off)
  return props.title ? props.message : undefined
})

/** The one-line message for the inline form (the countdown is a separate span, see the template). */
const inlineMessage = computed(() => (rateLimited.value === null ? props.message : RATE_LIMITED_TEXT))

/** The retry button of the alert form (`UAlert` takes button props; the test id rides along as an attribute). */
const actions = computed(() => [
  {
    label: props.retryLabel,
    color: 'neutral' as const,
    variant: 'soft' as const,
    loading: props.loading,
    disabled: retryDisabled.value,
    onClick: () => emit('retry'),
    ...(props.retryTestid ? { 'data-testid': props.retryTestid } : {}),
  },
])
</script>

<template>
  <div
    v-if="isInline"
    class="flex flex-wrap items-center gap-3 text-body text-error"
    role="alert"
    data-ds="load-error"
    :data-testid="testid"
  >
    <UIcon name="i-ph-warning-circle" class="size-5 shrink-0" />
    <span class="min-w-0 grow"
      >{{ inlineMessage }}<template v-if="rateLimited !== null && countdownText"
        >{{ ' ' }}<span aria-live="off">{{ countdownText }}</span></template
      ></span
    >
    <UButton
      type="button"
      color="neutral"
      variant="soft"
      :label="retryLabel"
      :loading="loading"
      :disabled="retryDisabled"
      :data-testid="retryTestid"
      @click="emit('retry')"
    />
  </div>
  <UAlert
    v-else
    color="error"
    variant="subtle"
    icon="i-ph-warning-circle"
    :title="alertTitle"
    :description="alertDescription"
    :actions="actions"
    role="alert"
    data-ds="load-error"
    :data-testid="testid"
  >
    <!-- The countdown changes every second: keep it out of the assertive live region's announcements. -->
    <template v-if="rateLimited !== null && countdownText" #description>
      <span aria-live="off">{{ countdownText }}</span>
    </template>
  </UAlert>
</template>
