<script setup lang="ts">
/** S9 `/admin-sekolah/pelajar/:id` "Edit Pengguna" (SRS M27 Part B FR-M27-94 to 98). */
import SchoolUserEditForm from '../components/users/SchoolUserEditForm.vue'

defineProps<{ id: number }>()
</script>

<template>
  <SchoolUserEditForm :id="id" role="student" />
</template>
