/**
 * M01 account client functions (SRS M01 v1.12 §7 #7–#12): the signed-in user's own profile,
 * picture, password and settings. Every call needs a session (401 → `/login`, FR-M01-14).
 */

import { api } from '@/api'

import type {
  ChangePasswordRequest,
  PicturePayload,
  StatusPayload,
  UpdateProfileRequest,
  UserMe,
  UserSettings,
  WithStatus,
} from './types'

/** #7 `GET /api/me`. */
export function getMe(): Promise<UserMe> {
  return api.get<UserMe>('/api/me')
}

/** #8 `PUT /api/me`: the saved user and the flash text (FR-M01-44). */
export async function updateProfile(request: UpdateProfileRequest): Promise<WithStatus<UserMe>> {
  return api.put<WithStatus<UserMe>>('/api/me', { body: request, raw: true })
}

/** #9 `POST /api/me/picture` (multipart `profilePicture`); the flash text is in `status`. */
export function uploadPicture(file: Blob): Promise<WithStatus<PicturePayload>> {
  const form = new FormData()
  form.append('profilePicture', file)
  return api.multipart<WithStatus<PicturePayload>>('/api/me/picture', form, { raw: true })
}

/** #10 `PUT /api/me/password` (the session is kept, BR-16). Resolves to the status text. */
export async function changePassword(request: ChangePasswordRequest): Promise<string> {
  const { status } = await api.put<StatusPayload>('/api/me/password', { body: request })
  return status
}

/** #11 `GET /api/me/settings` (defaults BR-17 for a user who never saved). */
export function getSettings(): Promise<UserSettings> {
  return api.get<UserSettings>('/api/me/settings')
}

/** #12 `PUT /api/me/settings`: every field is sent; an unticked checkbox is `false`. */
export function saveSettings(settings: UserSettings): Promise<WithStatus<UserSettings>> {
  return api.put<WithStatus<UserSettings>>('/api/me/settings', { body: settings, raw: true })
}
