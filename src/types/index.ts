// ==============================================================================
// Research Dashboard - Core TypeScript Types
// ==============================================================================

export type MetricDirection = 'higher_is_better' | 'lower_is_better';

export interface MetricDefinition {
  key: string;
  name: string;
  shortName: string;
  direction: MetricDirection;
  min?: number;
  max?: number;
  description?: string;
  defaultWeight: number; // For custom weighted ablation (0-100)
}

export interface LossDefinition {
  key: string;
  name: string;
  description?: string;
  color: string;
}

export interface ModelMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  architecture: string;
  numParameters?: string;
  authors?: string;
  colabUrl?: string;
  paperUrl?: string;
  githubUrl?: string;
  hyperparameters: Record<string, string | number | boolean>;
  colorTheme: {
    baseColor: string;
    glowColor: string;
    bgSoft: string;
    borderClass: string;
    badgeClass: string;
    textClass: string;
  };
}

export interface EpochHistoryPoint {
  epoch: number;
  metrics: Record<string, number>; // e.g. { ARI: 0.72, Silhouette: 0.35, NMI: 0.68 }
  losses: Record<string, number>;  // e.g. { total_loss: 14.2, recon_loss: 5.1, spatial_loss: 2.3 }
}

export interface SeedVisualizations {
  umap?: string;
  groundTruth?: string;
  prediction?: string;
  spatialMap?: string;
  violin?: string;
  customPlots?: Record<string, string>;
}

export interface SeedExperimentData {
  seed: number;
  bestEpoch: number;
  bestScore?: number;
  durationSeconds?: number;
  finalMetrics: Record<string, number>; // { ARI: 0.74, NMI: 0.70, Silhouette: 0.38, AMI: 0.69, Homogeneity: 0.71, "V-measure": 0.70, CHI: 1240.5, DBI: 0.89 }
  history: EpochHistoryPoint[];
  visualizations: SeedVisualizations;
}

export interface DatasetInfo {
  id: string;
  name: string;
  type: string;
  spotsCount: number;
  clustersCount: number;
  modality: string;
  description?: string;
}

export interface ModelDatasetResults {
  modelId: string;
  datasetId: string;
  seeds: Record<number, SeedExperimentData>;
  aggregatedMetrics: Record<string, {
    mean: number;
    median: number;
    stdDev: number;
    sem: number;
    cv: number; // Coefficient of variation %
    min: number;
    max: number;
    range: number;
    values: number[];
  }>;
}

export interface RawEvaluationRecord {
  modelId: string;
  modelName: string;
  datasetId: string;
  datasetName: string;
  seed: number;
  metrics: Record<string, number>;
  bestEpoch?: number;
}
