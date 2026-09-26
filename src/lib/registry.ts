import { MetricDefinition, LossDefinition, ModelMetadata, DatasetInfo } from '@/types';

export const METRIC_REGISTRY: MetricDefinition[] = [
  {
    key: 'ARI',
    name: 'Adjusted Rand Index',
    shortName: 'ARI',
    direction: 'higher_is_better',
    min: -1,
    max: 1,
    description: 'Measures similarity between true and predicted clusters adjusted for chance.',
    defaultWeight: 30,
  },
  {
    key: 'Silhouette',
    name: 'Silhouette Coefficient',
    shortName: 'Sil',
    direction: 'higher_is_better',
    min: -1,
    max: 1,
    description: 'Measures how similar an object is to its own cluster compared to other clusters.',
    defaultWeight: 25,
  },
  {
    key: 'NMI',
    name: 'Normalized Mutual Info',
    shortName: 'NMI',
    direction: 'higher_is_better',
    min: 0,
    max: 1,
    description: 'Mutual information normalized against entropy bounds.',
    defaultWeight: 15,
  },
  {
    key: 'AMI',
    name: 'Adjusted Mutual Info',
    shortName: 'AMI',
    direction: 'higher_is_better',
    min: 0,
    max: 1,
    description: 'Adjustment of the Mutual Information score to disregard chance groupings.',
    defaultWeight: 10,
  },
  {
    key: 'Homogeneity',
    name: 'Homogeneity Score',
    shortName: 'Homo',
    direction: 'higher_is_better',
    min: 0,
    max: 1,
    description: 'Validates that each cluster contains only members of a single class.',
    defaultWeight: 10,
  },
  {
    key: 'V-measure',
    name: 'V-Measure',
    shortName: 'V-Meas',
    direction: 'higher_is_better',
    min: 0,
    max: 1,
    description: 'Harmonic mean of homogeneity and completeness.',
    defaultWeight: 10,
  },
  {
    key: 'CHI',
    name: 'Calinski-Harabasz Index',
    shortName: 'CHI',
    direction: 'higher_is_better',
    description: 'Ratio of sum of between-clusters dispersion and within-cluster dispersion.',
    defaultWeight: 0,
  },
  {
    key: 'DBI',
    name: 'Davies-Bouldin Index',
    shortName: 'DBI',
    direction: 'lower_is_better',
    description: 'Average similarity measure of each cluster with its most similar cluster (Lower is better).',
    defaultWeight: 0,
  },
];

export const LOSS_REGISTRY: LossDefinition[] = [
  {
    key: 'total_loss',
    name: 'Total Loss',
    description: 'Weighted combination of all objective losses',
    color: '#6366f1',
  },
  {
    key: 'reconstruction_loss',
    name: 'Reconstruction Loss',
    description: 'Decoded RNA & auxiliary modality feature reconstruction MSE',
    color: '#3b82f6',
  },
  {
    key: 'spatial_loss',
    name: 'Spatial Regularization Loss',
    description: 'Graph spatial neighbor consistency loss',
    color: '#10b981',
  },
  {
    key: 'similarity_loss',
    name: 'Similarity Graph Loss',
    description: 'KNN similarity topology preservation loss',
    color: '#f59e0b',
  },
  {
    key: 'reg_loss',
    name: 'Weight Decay (L1/L2) Loss',
    description: 'Parameter regularization penalty',
    color: '#ec4899',
  },
];

export const DATASET_REGISTRY: DatasetInfo[] = [
  {
    id: '10x_human_lymph_node_A1',
    name: '10x Human Lymph Node A1',
    type: '10x Visium + ADT',
    spotsCount: 4039,
    clustersCount: 9,
    modality: 'RNA + Protein (ADT)',
    description: 'Spatial transcriptomics and proteomics profiling of human lymph node section A1.'
  },
  {
    id: '10x_human_lymph_node_D1',
    name: '10x Human Lymph Node D1',
    type: '10x Visium + ADT',
    spotsCount: 4035,
    clustersCount: 9,
    modality: 'RNA + Protein (ADT)',
    description: 'Spatial multi-omics profiling of human lymph node replicate section D1.'
  },
  {
    id: 'Mouse_Brain_E11_S1',
    name: 'Mouse Brain E11 S1',
    type: 'Spatial Epigenome-Transcriptome',
    spotsCount: 2841,
    clustersCount: 14,
    modality: 'RNA + ATAC',
    description: 'Mouse embryonic brain at day E11 slice 1.'
  },
  {
    id: 'Mouse_Brain_E13_S1',
    name: 'Mouse Brain E13 S1',
    type: 'Spatial Epigenome-Transcriptome',
    spotsCount: 3102,
    clustersCount: 15,
    modality: 'RNA + ATAC',
    description: 'Mouse embryonic brain development day E13 slice 1.'
  },
  {
    id: 'Mouse_Brain_E15_S1',
    name: 'Mouse Brain E15 S1',
    type: 'Spatial Epigenome-Transcriptome',
    spotsCount: 3345,
    clustersCount: 16,
    modality: 'RNA + ATAC',
    description: 'Mouse embryonic brain developmental stage E15 slice 1.'
  },
  {
    id: 'Mouse_Brain_E18_S1',
    name: 'Mouse Brain E18 S1',
    type: 'Spatial Epigenome-Transcriptome',
    spotsCount: 3678,
    clustersCount: 18,
    modality: 'RNA + ATAC',
    description: 'Late embryonic mouse brain stage E18 slice 1.'
  },
];

// Generates dynamic theme tokens for any new model added on the fly
const PALETTE_HUES = [215, 262, 160, 343, 38, 315, 195, 280, 140, 25];

export function generateModelColorTheme(indexOrSeed: number) {
  const hue = PALETTE_HUES[Math.abs(indexOrSeed) % PALETTE_HUES.length];
  return {
    baseColor: `hsl(${hue}, 85%, 55%)`,
    glowColor: `hsla(${hue}, 85%, 55%, 0.2)`,
    bgSoft: `hsla(${hue}, 85%, 55%, 0.08)`,
    borderClass: `border-indigo-500/40`,
    badgeClass: `bg-indigo-500/10 text-indigo-400 border-indigo-500/20`,
    textClass: `text-indigo-400`,
  };
}

// Initial empty registry: Models are created dynamically as experiments are submitted
export const MODEL_REGISTRY: ModelMetadata[] = [];
