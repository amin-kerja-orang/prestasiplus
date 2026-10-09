<script setup lang="ts">
/**
 * W `/marketplace/:slug/whatsapp` (FR-M20-58; BR-M20-21; D14): no screen of its own. It runs in the new
 * tab opened by the S7 button: it calls #16 (records the click, returns the `wa.me` URL) and then
 * `location.replace()`s the tab with that URL, the simulated outcome of the external hand-off. An
 * unknown or hidden slug renders the in-place 404 page; another failure shows the load-error box.
 */
import { onMounted, ref } from 'vue'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'

import { recordWhatsappClick } from '../api'
import LoadError from '../components/product/LoadError.vue'

const props = defineProps<{ slug: string }>()
const failed = ref(false)

async function handOff(): Promise<void> {
  failed.value = false
  try {
    const { url } = await recordWhatsappClick(props.slug)
    location.replace(url)
  } catch (err) {
    if (isApiError(err) && err.status === 404) setRouteOutcome(404)
    else failed.value = true
  }
}

onMounted(() => {
  void handOff()
})
</script>

<template>
  <div v-if="failed" class="mx-auto max-w-xl p-4" data-testid="whatsapp-error">
    <LoadError @retry="handOff" />
  </div>
  <div v-else data-testid="whatsapp-handoff" />
</template>
