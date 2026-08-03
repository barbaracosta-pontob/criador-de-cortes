/**
 * Bridge entre o app Next.js e o serviço de análise (detecção de cortes).
 *
 * Importa direto do source TypeScript do serviço; o Next.js transpila via
 * transpilePackages/webpack alias configurados em next.config.js.
 */

export { analyzeCuts, refineCuts, CutAnalysisError } from "../../../../services/analysis/src/claude";
export type {
  AnalyzeCutsParams,
  RefineCutsParams,
  CutsAnalysisResult,
  EspecialistaContexto,
} from "../../../../services/analysis/src/claude";
