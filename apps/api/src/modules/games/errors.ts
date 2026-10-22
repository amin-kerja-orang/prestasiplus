import { GAMES_MESSAGES } from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'

/**
 * Error factories of the games module (BE-45). Exact BM copy from `GAMES_MESSAGES`. Standard envelope
 * (`{error:{code,message,fields?}}`) only: the RAW bodies (quick-match `{error}`, solo submit `{message}`,
 * spin `{success:false,message}`) are NOT thrown; routes return them with `res.status(n)` (see FOUNDATION.md).
 */
const M = GAMES_MESSAGES

/** 422 with `fields[field] = message` and the same top-level message. */
export const fieldError = (field: string, message: string): ApiError =>
  ApiError.of('VALIDATION_ERROR', { message, fields: { [field]: message } })

// 404
export const gameNotFound = (): ApiError => ApiError.of('NOT_FOUND', { message: M.gameNotFound })
export const roomNotFound = (): ApiError => ApiError.of('NOT_FOUND', { message: M.roomNotFound })
export const jutawanSessionNotFound = (): ApiError => ApiError.of('NOT_FOUND', { message: M.jutawanSessionNotFound })
export const jutawanQuestionNotFound = (): ApiError => ApiError.of('NOT_FOUND', { message: M.jutawanQuestionNotFound })
export const leagueNotFound = (): ApiError => ApiError.of('NOT_FOUND', { message: M.leagueNotFound })
/** [PROPOSED] check/reveal 404s (standard envelope; copy reused from Jutawan). */
export const soloSessionNotFound = (): ApiError => ApiError.of('NOT_FOUND', { message: M.soloSessionNotFound })
export const soloItemNotFound = (): ApiError => ApiError.of('NOT_FOUND', { message: M.soloItemNotFound })

// 403
export const startHostOnly = (): ApiError => ApiError.of('FORBIDDEN', { message: M.startHostOnly })
export const actionNotYourTurn = (): ApiError => ApiError.of('FORBIDDEN', { message: M.actionNotYourTurn })

// 409
export const startAlreadyStarted = (): ApiError => ApiError.of('CONFLICT', { message: M.startAlreadyStarted })
export const startNotEnoughPlayers = (): ApiError => ApiError.of('CONFLICT', { message: M.startNotEnoughPlayers })
export const startNotEnoughQuestions = (): ApiError => ApiError.of('CONFLICT', { message: M.startNotEnoughQuestions })
export const actionNotStarted = (): ApiError => ApiError.of('CONFLICT', { message: M.actionNotStarted })
export const actionNotYourRoll = (): ApiError => ApiError.of('CONFLICT', { message: M.actionNotYourRoll })
export const actionNoQuestion = (): ApiError => ApiError.of('CONFLICT', { message: M.actionNoQuestion })
export const actionNoClock = (): ApiError => ApiError.of('CONFLICT', { message: M.actionNoClock })
export const jutawanOver = (): ApiError => ApiError.of('CONFLICT', { message: M.jutawanOver })
export const jutawanNoLifeline = (): ApiError => ApiError.of('CONFLICT', { message: M.jutawanNoLifeline })
/** [PROPOSED] check/reveal 409s. */
export const soloAlreadyChecked = (): ApiError => ApiError.of('CONFLICT', { message: M.soloAlreadyChecked })
export const soloCardMatched = (): ApiError => ApiError.of('CONFLICT', { message: M.soloCardMatched })
export const soloCardOpen = (): ApiError => ApiError.of('CONFLICT', { message: M.soloCardOpen })

// 422 (field-level)
export const levelInvalid = (field = 'darjah'): ApiError => fieldError(field, M.level)
export const roomSubjectInvalid = (): ApiError => fieldError('subject', M.roomSubject)
export const roomGradeLevelInvalid = (): ApiError => fieldError('grade_level', M.roomGradeLevel)
export const roomRangeInvalid = (field = 'match_mode'): ApiError => fieldError(field, M.roomRange)
export const roomMaxPlayersInvalid = (): ApiError => fieldError('max_players', M.roomMaxPlayers)
export const actionQuestionInvalid = (): ApiError => fieldError('questionId', M.actionQuestion)
export const actionOptionInvalid = (): ApiError => fieldError('optionId', M.actionOption)
export const actionSecondsInvalid = (): ApiError => fieldError('seconds', M.actionSeconds)
export const actionTypeInvalid = (): ApiError => fieldError('type', M.actionType)
export const actionQuestionMismatch = (): ApiError => fieldError('questionId', M.actionQuestionMismatch)
export const actionValueInvalid = (field = 'value'): ApiError => fieldError(field, M.actionValue)
export const jutawanSubjectInvalid = (): ApiError => fieldError('subject', M.jutawanSubject)
export const jutawanNotEnoughQuestions = (): ApiError => fieldError('subject', M.jutawanNotEnoughQuestions)
export const jutawanQuestionMismatch = (): ApiError => fieldError('questionId', M.jutawanQuestionMismatch)
export const jutawanOptionInvalid = (): ApiError => fieldError('optionId', M.jutawanOption)
export const jutawanLifelineInvalid = (): ApiError => fieldError('type', M.jutawanLifelineType)
export const quizTilesInvalid = (): ApiError => fieldError('boardgame_quiz_tiles', M.quizTiles)
/** Leagues: the top-level message is the first field message. */
export const leagueInvalid = (field: string, message: string): ApiError => fieldError(field, message)
export const leagueInviteInvalid = (): ApiError => fieldError('invite_code', M.leagueInviteInvalid)
export const leagueEnded = (): ApiError => fieldError('invite_code', M.leagueEnded)
export const leagueNeedsSchool = (): ApiError => fieldError('invite_code', M.leagueNeedsSchool)
export const leagueAlreadyIn = (): ApiError => fieldError('invite_code', M.leagueAlreadyIn)
export const leagueFull = (): ApiError => fieldError('invite_code', M.leagueFull)

/** The raw (un-enveloped) bodies. Routes return these with `res.status(n)` instead of throwing. */
export const rawMessage = (message: string): { message: string } => ({ message })
export const rawError = (error: string): { error: string } => ({ error })
export const rawSpinRefused = (): { success: false; message: string } => ({ success: false, message: M.spinAlreadySpun })
