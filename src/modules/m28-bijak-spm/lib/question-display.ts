/**
 * The one door to the shared question display library (`src/components/question-display`, FE-P5).
 * The library predates the `@/components/*` freeze rule and is the shared home the Bijak/Kuiz pages
 * are told to reuse, so the single exemption lives here instead of in every page.
 */
 
export { McqOptions, StimulusFigure, StimulusGroup } from '@/components/question-display'
export type { McqOptionData, StimulusData, StimulusKind } from '@/components/question-display'
