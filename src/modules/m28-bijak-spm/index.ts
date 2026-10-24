/**
 * Bijak SPM (v2 student flow, mock-backed). Public entry: the route table and the paper count read
 * by the SPM hub. The mock server and its data are this module's own store and are not shared with
 * M04 / M05 / M06.
 */
export { default as bijakRoutes } from './routes'
export { useBijakPaperCount } from './lib/use-paper-count'
