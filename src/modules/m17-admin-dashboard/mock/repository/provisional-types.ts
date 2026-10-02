/**
 * Row types of the three provisional stores hosted in M17 (F-33; build-plan §2.9, overview §6.7.2,
 * XL3-23). The true owners are M26 (mood check-ins, tuition centres) and M21 (sponsors); none is
 * built yet, so M17 hosts the definitions with `provisional: true`. The shapes are PROVISIONAL
 * (no M26 SRS exists): M17 §6.1 and XR-M17-17/18 give only the field names. The sponsor shape is
 * DATA-M21-01 (M21 SRS v1.2 §6.2), so the move to M21 changes nothing.
 */

export const MOODS = ['happy', 'okay', 'sad', 'stressed'] as const
export type Mood = (typeof MOODS)[number]

/** Mood check-in (owner M26, PROVISIONAL shape, XR-M17-18). `date` is the MYT calendar day. */
export interface MoodCheckinRow {
  id: number
  userId: number
  mood: Mood
  /** The pupil's reason ("Sebab" of the S7 mood-day modal); `null` when none was given. */
  reason: string | null
  /** `YYYY-MM-DD` (MYT). */
  date: string
}

/**
 * Tuition centre (owner M26, PROVISIONAL shape, XR-M17-17). `activePupils` is the displayed
 * "pelajar aktif" figure; the M26 definition (pupils linked to the centre with at least one answer
 * in 30 days) is PROPOSED, so the observed figure is stored on the row until M26 defines the link.
 */
export interface TuitionCentreRow {
  id: number
  name: string
  city: string
  state: string
  activePupils: number
}

export const SPONSOR_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const
export type SponsorStatus = (typeof SPONSOR_STATUSES)[number]

/** Sponsor (owner M21, DATA-M21-01 of the M21 SRS v1.2 §6.2). */
export interface SponsorRow {
  id: number
  userId: number | null
  name: string
  /** One of the 13 M21 category codes (§6.5); free text here until M21 owns the enum. */
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

/** An inclusive `YYYY-MM-DD` window; a missing side is open. */
export interface DateWindow {
  from?: string
  to?: string
}
