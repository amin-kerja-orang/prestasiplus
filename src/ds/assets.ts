/**
 * Bundled art for the composites (design system 10.2, 10.3, guard G-12): Fluent Emoji 3D rewards
 * and the two virtual-friend faces. Local files only, never a remote URL.
 */
import books from '@/assets/v2/3d/books_3d.png'
import cap from '@/assets/v2/3d/graduation_cap_3d.png'
import coin from '@/assets/v2/3d/coin_3d.png'
import fire from '@/assets/v2/3d/fire_3d.png'
import bolt from '@/assets/v2/3d/high_voltage_3d.png'
import party from '@/assets/v2/3d/party_popper_3d.png'
import rocket from '@/assets/v2/3d/rocket_3d.png'
import trophy from '@/assets/v2/3d/trophy_3d.png'
import aiman from '@/assets/v2/friends/aiman_face.png'
import aisyah from '@/assets/v2/friends/aisyah_face.png'

export const art3dSources = { fire, coin, bolt, trophy, party, rocket, books, cap } as const
export type Art3DName = keyof typeof art3dSources
export const art3dNames = Object.keys(art3dSources) as Art3DName[]

export const friendFaces = { aiman, aisyah } as const
export type FriendId = keyof typeof friendFaces
export const friendIds = Object.keys(friendFaces) as FriendId[]
