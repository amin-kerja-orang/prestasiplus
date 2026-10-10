<script setup lang="ts">
/** S10 `/admin-sekolah/guru/:id` "Edit Pengguna" (SRS M27 Part B FR-M27-104 to 107). */
import SchoolUserEditForm from '../components/users/SchoolUserEditForm.vue'

defineProps<{ id: number }>()
</script>

<template>
  <SchoolUserEditForm :id="id" role="teacher" />
</template>
