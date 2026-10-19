<script setup lang="ts">
/**
 * "Menyamar" of an S6 / S7 row (FR-M27-121, 122, 124; BR-M27-42; M27-T6). Enabled for an active pupil or teacher,
 * otherwise present but disabled with `title` "Akaun ini tidak aktif". Pressing an enabled one asks the confirm
 * (`useConfirm`, same BM text), then calls #20: the stored session becomes the target's (with the actor parked as
 * `impersonator`, which the shell banner reads), the flash "Anda kini menyamar sebagai {name}." is queued and the
 * app opens the target's landing path. A refusal (404, 403, 409) shows the server message as an error flash on the
 * current page.
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { useFlash } from '@/composables'
import { useConfirm } from '@/ds'
import { useSessionStore } from '@/stores/session'

import { impersonateSchoolUser } from '../../api/school-admin'
import { errorLines, PUPIL_LIST_PATH, TEACHER_LIST_PATH, type SchoolUserRole } from './users-format'

const props = defineProps<{
  userId: number
  name: string
  isActive: boolean
  role: SchoolUserRole
}>()

const router = useRouter()
const session = useSessionStore()
const flash = useFlash()
const confirm = useConfirm()
const busy = ref(false)

async function start(): Promise<void> {
  if (busy.value || !props.isActive) return
  const ok = await confirm({
    message: `Log masuk sebagai ${props.name}? Anda boleh kembali bila-bila masa.`,
  })
  if (!ok) return
  busy.value = true
  try {
    const result = await impersonateSchoolUser(props.userId)
    const { token, expiresAt, user, impersonator } = result.data
    session.setSession({
      token,
      remember: false,
      expiresAt,
      user,
      impersonator: {
        id: impersonator.id,
        name: impersonator.name,
        returnTo: props.role === 'student' ? PUPIL_LIST_PATH : TEACHER_LIST_PATH,
      },
    })
    flash.success(result.status)
    await router.push(user.landingPath)
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UButton
    type="button"
    color="neutral"
    variant="soft"
    size="lg"
    icon="i-ph-user-switch"
    class="min-h-11"
    :disabled="!isActive || busy"
    :title="isActive ? 'Log masuk sebagai pengguna ini' : 'Akaun ini tidak aktif'"
    data-testid="user-impersonate"
    @click="start"
    >Menyamar</UButton
  >
</template>
