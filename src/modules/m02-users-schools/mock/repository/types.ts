/**
 * Row types of the M02 stores (SRS v1.18 §6.3–§6.4). Integer ids (XL-06).
 */

/** BR-21 school types (live uses only SK and SMK, §6.15 A). */
export type SchoolType = 'SK' | 'SMK' | 'SJK(C)' | 'SJK(T)' | 'MRSM' | 'SBP'

/** DATA-M02-03 School (the stored fields; `studentCount` / `teacherCount` are computed). */
export interface School {
  id: number
  /** Stored as entered (live data mostly upper case). */
  name: string
  /** KPM code, e.g. "BBD4051"; `''` = no code ("Tiada kod"). */
  code: string
  type: SchoolType
  /** One of the 16 full state names. */
  state: string
  /** PPD / PPW code as stored, e.g. "PPD HULU LANGAT"; null when not set. */
  district: string | null
  city: string | null
  isActive: boolean
  /** ISO 8601 (+08:00). */
  createdAt: string
  updatedAt: string
}

export type SchoolFacetKey = 'state' | 'district' | 'type' | 'isActive'
export type SchoolCheapKey = 'name' | 'code' | 'createdAt'
export type SchoolFacets = Pick<School, SchoolFacetKey>

/** M01 DATA-M01-06 `SchoolSummary` (= the projection of a School). */
export interface SchoolSummary {
  id: number
  name: string
  code: string
  type: string
  state: string
  district: string | null
  city: string | null
}

/** §6.3 `SchoolOption` (§7 #43). */
export interface SchoolOption {
  id: number
  name: string
}

/** DATA-M02-04. */
export interface Jpn {
  id: number
  code: string
  name: string
}

/** DATA-M02-05. */
export interface Ppd {
  id: number
  jpnId: number
  code: string
  name: string
}
