/**
 * M21 student endpoint (SRS M21 v1.2 §7 #15), any signed-in role. UI tasks read this file and do not
 * change it. Errors reach the caller as `ApiError`: `401`; `422` with the `fields` map
 * (`studentEmail`, `studentCategory`, `familyIncomeRange`, `reason`; copy in
 * `FOSTER_APPLICATION_MESSAGES`); 5xx.
 */

import { api } from '@/api'

import type { FosterApplicationCreated, FosterApplicationInput } from './types'

/** #15 `POST /api/mohon-keluarga-angkat` (S6 "Hantar Permohonan"; 201 `{id}`). */
export function submitFosterApplication(
  input: FosterApplicationInput,
): Promise<FosterApplicationCreated> {
  return api.post<FosterApplicationCreated>('/api/mohon-keluarga-angkat', {
    body: {
      studentEmail: input.studentEmail,
      studentCategory: input.studentCategory,
      familyIncomeRange: input.familyIncomeRange === '' ? null : (input.familyIncomeRange ?? null),
      reason: input.reason,
    },
  })
}
