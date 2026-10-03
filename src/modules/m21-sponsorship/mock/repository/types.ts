/**
 * Row types of the M21 stores (SRS M21 v1.2 §6.2-§6.4). `SponsorRow` is DATA-M21-01, taken over
 * unchanged from M17's provisional host (F-33, M21-T1). `AnakAngkatRow` and `FosterApplicationRow`
 * are DATA-M21-02 / 03; their enumerations live in `../../api/types`.
 */

import type {
  AnakAngkatChannel,
  AnakAngkatStatus,
  ApplicationCategory,
  ApplicationStatus,
  FamilyIncomeRange,
} from '../../api/types'

export const SPONSOR_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const
export type SponsorStatus = (typeof SPONSOR_STATUSES)[number]

/** Sponsor (owner M21, DATA-M21-01 of the M21 SRS v1.2 §6.2). */
export interface SponsorRow {
  id: number
  userId: number | null
  name: string
  /** One of the 13 M21 category codes (§6.5); free text in the row, as in the moved definition. */
  category: string
  description: string | null
  tagline: string | null
  website: string | null
  logoUrl: string | null
  registrationNumber: string | null
  contactPersonName: string | null
  contactPersonPosition: string | null
  contactEmail: string | null
  contactPhone: string | null
  address: string | null
  city: string | null
  state: string | null
  postcode: string | null
  status: SponsorStatus
  /** ISO datetime with the MYT offset. */
  createdAt: string
}

/** The M17 "Kad Penaja" figures (Q-M17-SPONSORS): `active` = APPROVED. */
export interface SponsorStatusCounts {
  total: number
  active: number
  pending: number
  rejected: number
  suspended: number
}

/** DATA-M21-02. */
export interface AnakAngkatRow {
  id: number
  sponsorId: number
  studentId: number
  studentCategory: 'B40' | 'Asnaf' | 'Yatim' | 'OKU' | null
  channel: AnakAngkatChannel
  status: AnakAngkatStatus
  applicationId: number | null
  createdAt: string
}

/** DATA-M21-03. */
export interface FosterApplicationRow {
  id: number
  studentId: number
  applicantUserId: number
  /** Role code of the applicant at submission, shown raw. */
  applicantRole: string
  studentCategory: ApplicationCategory
  familyIncomeRange: FamilyIncomeRange | null
  reason: string
  status: ApplicationStatus
  createdAt: string
}
