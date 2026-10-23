<script setup lang="ts">
/**
 * `/password/reset` entry (SW8-07b). The v2 API mails `/password/reset#token=...&email=...` with the
 * token in the URL FRAGMENT only, so it never reaches a server, a log or a Referer header. With a
 * token in the fragment this shows S4 (the reset form) with the token held in component state; the
 * fragment is read once and scrubbed from the address bar at once (`router.replace`, hash dropped;
 * the token never enters the path or the query). The e-mail in the fragment pre-fills the form.
 * Without a token in the fragment this is S3 (`PasswordForgotPage`), exactly as before. The path
 * route `/password/reset/:token` is untouched and renders S4 itself.
 */
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import PasswordForgotPage from './PasswordForgotPage.vue'
import PasswordResetPage from './PasswordResetPage.vue'

const RESET_TITLE = 'Reset Kata Laluan - PRESTASIPLUS'

const route = useRoute()
const router = useRouter()

function decode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * The fragment as `key -> value`. vue-router has already percent-decoded `route.hash`, which would
 * make `%26` / `%2B` in a value ambiguous, so the browser's raw hash is parsed when there is one.
 * Values are percent-decoded only (`+` is a plus, as `encodeURIComponent` in the mail writes it).
 */
function fragmentParams(): Map<string, string> {
  const raw = typeof window === 'undefined' ? '' : window.location.hash
  const fromBrowser = raw.length > 1
  const text = (fromBrowser ? raw : route.hash).replace(/^#/, '')
  const out = new Map<string, string>()
  for (const part of text.split('&')) {
    const at = part.indexOf('=')
    const key = at < 0 ? part : part.slice(0, at)
    const value = at < 0 ? '' : part.slice(at + 1)
    if (key !== '' && !out.has(key)) out.set(key, fromBrowser ? decode(value) : value)
  }
  return out
}

// Read once, in setup: the scrub below changes `route.hash`, the captured values stay.
const params = fragmentParams()
const hasTokenKey = params.has('token')
const token = (params.get('token') ?? '').trim()
const email = params.get('email')
const showReset = token !== ''

onMounted(() => {
  if (!hasTokenKey) return
  void router
    .replace({ path: route.path, query: route.query, hash: '' })
    // The after-each hook puts the S3 title back; the reset form keeps the S4 title.
    .then(() => {
      if (showReset) document.title = RESET_TITLE
    })
})
</script>

<template>
  <PasswordResetPage v-if="showReset" :token="token" :email="email" />
  <PasswordForgotPage v-else />
</template>
