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

// Signature color themes for known models
export const KNOWN_MODEL_PALETTES: Record<string, {
  baseColor: string;
  glowColor: string;
  bgSoft: string;
  borderClass: string;
  badgeClass: string;
  textClass: string;
}> = {
  smart: {
    baseColor: 'hsl(262, 85%, 60%)', // Vibrant Purple
    glowColor: 'hsla(262, 85%, 60%, 0.2)',
    bgSoft: 'hsla(262, 85%, 60%, 0.08)',
    borderClass: 'border-purple-500/40',
    badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    textClass: 'text-purple-600 dark:text-purple-400',
  },
  spatialglue: {
    baseColor: 'hsl(38, 95%, 52%)', // Warm Amber/Gold
    glowColor: 'hsla(38, 95%, 52%, 0.2)',
    bgSoft: 'hsla(38, 95%, 52%, 0.08)',
    borderClass: 'border-amber-500/40',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    textClass: 'text-amber-600 dark:text-amber-400',
  },
  arise: {
    baseColor: 'hsl(343, 90%, 60%)', // Rose/Crimson
    glowColor: 'hsla(343, 90%, 60%, 0.2)',
    bgSoft: 'hsla(343, 90%, 60%, 0.08)',
    borderClass: 'border-rose-500/40',
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    textClass: 'text-rose-600 dark:text-rose-400',
  },
  arisespatialglue: {
    baseColor: 'hsl(315, 85%, 55%)', // Magenta/Fuchsia
    glowColor: 'hsla(315, 85%, 55%, 0.2)',
    bgSoft: 'hsla(315, 85%, 55%, 0.08)',
    borderClass: 'border-pink-500/40',
    badgeClass: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
    textClass: 'text-pink-600 dark:text-pink-400',
  },
  astra: {
    baseColor: 'hsl(195, 90%, 48%)', // Electric Cyan/Sky
    glowColor: 'hsla(195, 90%, 48%, 0.2)',
    bgSoft: 'hsla(195, 90%, 48%, 0.08)',
    borderClass: 'border-cyan-500/40',
    badgeClass: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    textClass: 'text-cyan-600 dark:text-cyan-400',
  },
  cage: {
    baseColor: 'hsl(160, 84%, 40%)', // Emerald/Teal
    glowColor: 'hsla(160, 84%, 40%, 0.2)',
    bgSoft: 'hsla(160, 84%, 40%, 0.08)',
    borderClass: 'border-emerald-500/40',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    textClass: 'text-emerald-600 dark:text-emerald-400',
  },
  sedr: {
    baseColor: 'hsl(280, 85%, 62%)', // Indigo/Violet
    glowColor: 'hsla(280, 85%, 62%, 0.2)',
    bgSoft: 'hsla(280, 85%, 62%, 0.08)',
    borderClass: 'border-violet-500/40',
    badgeClass: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
    textClass: 'text-violet-600 dark:text-violet-400',
  },
  stagate: {
    baseColor: 'hsl(215, 90%, 55%)', // Royal Blue
    glowColor: 'hsla(215, 90%, 55%, 0.2)',
    bgSoft: 'hsla(215, 90%, 55%, 0.08)',
    borderClass: 'border-blue-500/40',
    badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    textClass: 'text-blue-600 dark:text-blue-400',
  },
};

// Generates dynamic theme tokens for any new or custom model
const PALETTE_HUES = [262, 38, 343, 195, 160, 315, 280, 215, 140, 25];

export function generateModelColorTheme(indexOrSeed: number) {
  const hue = PALETTE_HUES[Math.abs(indexOrSeed) % PALETTE_HUES.length];
  return {
    baseColor: `hsl(${hue}, 85%, 55%)`,
    glowColor: `hsla(${hue}, 85%, 55%, 0.2)`,
    bgSoft: `hsla(${hue}, 85%, 55%, 0.08)`,
    borderClass: `border-indigo-500/40`,
    badgeClass: `bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20`,
    textClass: `text-indigo-600 dark:text-indigo-400`,
  };
}

/**
 * Resolves a model's distinct color theme:
 * 1. Matches against known canonical models (SMART, SpatialGlue, ARISE, Astra, CAGE, etc.)
 * 2. If existing theme is just the default blue fallback, replaces with canonical distinct color
 * 3. Otherwise generates a distinct deterministic color by index/hash
 */
export function resolveModelColorTheme(modelId: string, modelName: string = '', index: number = 0) {
  const cleanId = (modelId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanName = (modelName || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // Check known palettes
  if (cleanId.includes('arisespatialglue') || cleanId.includes('4encoder') || cleanName.includes('4encoder')) {
    return KNOWN_MODEL_PALETTES.arisespatialglue;
  }
  if (cleanId.startsWith('arise') || cleanName.startsWith('arise')) {
    return KNOWN_MODEL_PALETTES.arise;
  }
  if (cleanId.includes('smart') || cleanName.includes('smart')) {
    return KNOWN_MODEL_PALETTES.smart;
  }
  if (cleanId.includes('spatialglue') || cleanName.includes('spatialglue')) {
    return KNOWN_MODEL_PALETTES.spatialglue;
  }
  if (cleanId.includes('astra') || cleanName.includes('astra')) {
    return KNOWN_MODEL_PALETTES.astra;
  }
  if (cleanId.includes('cage') || cleanName.includes('cage')) {
    return KNOWN_MODEL_PALETTES.cage;
  }
  if (cleanId.includes('sedr') || cleanName.includes('sedr')) {
    return KNOWN_MODEL_PALETTES.sedr;
  }
  if (cleanId.includes('stagate') || cleanName.includes('stagate')) {
    return KNOWN_MODEL_PALETTES.stagate;
  }

  // Fallback to distinct hue by index
  return generateModelColorTheme(index);
}

// Initial empty registry: Models are created dynamically as experiments are submitted
export const MODEL_REGISTRY: ModelMetadata[] = [];

