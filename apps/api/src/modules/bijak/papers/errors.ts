import { BIJAK_PAPERS_MESSAGES, type BijakGenerateShortage } from '@pp/contract'

import { ApiError } from '../../../common/errors/api-error'

/** 404 for an unknown id, an unpublished paper or another user's generated paper (no leak which). */
export const paperNotFound = (): ApiError => ApiError.of('NOT_FOUND', { message: BIJAK_PAPERS_MESSAGES.paperNotFound })

/** 422 NO_BLUEPRINT: no active blueprint for (subject, kertas), or its source is Draf. */
export const noBlueprint = (): ApiError =>
  new ApiError({ code: 'NO_BLUEPRINT', status: 422, message: BIJAK_PAPERS_MESSAGES.noBlueprint })

/** 503 GENERATE_LIMIT: the solver budget was reached (no paper is created). */
export const generateLimit = (): ApiError =>
  new ApiError({ code: 'GENERATE_LIMIT', status: 503, message: BIJAK_PAPERS_MESSAGES.generateLimit })

/** 422 SHORTAGE with the shortage list. */
export const shortage = (shortages: BijakGenerateShortage[]): ApiError =>
  new ApiError({ code: 'SHORTAGE', status: 422, message: BIJAK_PAPERS_MESSAGES.shortage, details: { shortages } })
