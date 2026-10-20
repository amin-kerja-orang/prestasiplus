/**
 * One rule, BE-09's: the tag gate and the key-marks gate live in `questions/publish-gate.ts`
 * (messages in `questions/errors.ts`). This file only re-exports them under the names the workflow
 * already imports, so BE-10 and the question bank never disagree.
 */
export { checkKeysGate, checkTagGate, type TagGateInput } from '../../publish-gate'
export { leavesOf } from '../../grading'
