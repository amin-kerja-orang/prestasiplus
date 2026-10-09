import type { IconMap } from '../types'
import { iconMap as m01 } from './m01-authentication'
import { iconMap as m02 } from './m02-users-schools'
import { iconMap as m03 } from './m03-curriculum'
import { iconMap as m04 } from './m04-question-bank'
import { iconMap as m05 } from './m05-practice'
import { iconMap as m06 } from './m06-spm'
import { iconMap as m07 } from './m07-pksk'
import { iconMap as m08 } from './m08-student-performance'
import { iconMap as m09 } from './m09-content'
import { iconMap as m10 } from './m10-teacher-class'
import { iconMap as m12 } from './m12-kirkpatrick'
import { iconMap as m16 } from './m16-battle-games'

/** Per-module icon maps, in module order (written once by F-14; modules edit only their own file). */
export const MODULE_ICON_MAPS: Readonly<Record<string, IconMap>> = {
  m01,
  m02,
  m03,
  m04,
  m05,
  m06,
  m07,
  m08,
  m09,
  m10,
  m12,
  m16,
}
