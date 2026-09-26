import mongoose, { Schema, Document, Model } from 'mongoose';

// ==============================================================================
// 1. Model Definition Schema
// ==============================================================================
export interface IModel extends Document {
  id: string;
  name: string;
  version: string;
  description: string;
  architecture: string;
  numParameters?: string;
  authors?: string;
  colabUrl?: string;
  hyperparameters: Record<string, any>;
  colorTheme?: {
    baseColor: string;
    glowColor: string;
    bgSoft: string;
    borderClass: string;
    badgeClass: string;
    textClass: string;
  };
  createdAt: Date;
}

const ModelSchema = new Schema<IModel>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  version: { type: String, default: 'v1.0' },
  description: { type: String, default: '' },
  architecture: { type: String, default: 'Custom Model' },
  numParameters: { type: String },
  authors: { type: String },
  colabUrl: { type: String },
  hyperparameters: { type: Schema.Types.Mixed, default: {} },
  colorTheme: {
    baseColor: { type: String, default: 'hsl(215, 90%, 55%)' },
    glowColor: { type: String, default: 'hsla(215, 90%, 55%, 0.2)' },
    bgSoft: { type: String, default: 'hsla(215, 90%, 55%, 0.08)' },
    borderClass: { type: String, default: 'border-blue-500/40' },
    badgeClass: { type: String, default: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    textClass: { type: String, default: 'text-blue-400' },
  },
  createdAt: { type: Date, default: Date.now },
});

// ==============================================================================
// 2. Experiment Run Schema
// ==============================================================================
export interface IExperimentRun extends Document {
  modelId: string;
  modelName: string;
  datasetId: string;
  datasetName: string;
  seed: number;
  bestEpoch: number;
  bestScore?: number;
  durationSeconds?: number;
  finalMetrics: Record<string, number>; // ARI, Silhouette, NMI, AMI, etc.
  history: Array<{
    epoch: number;
    metrics: Record<string, number>;
    losses: Record<string, number>;
  }>;
  visualizations: {
    umap?: string;
    groundTruth?: string;
    prediction?: string;
    spatialMap?: string;
    violin?: string;
    customPlots?: Record<string, string>;
  };
  embeddingsData?: {
    umapCoordinates?: number[][];
    spatialCoordinates?: number[][];
    predictedLabels?: Array<number | string>;
    groundTruthLabels?: Array<number | string>;
    sampleSilhouettes?: number[];
  };
  createdAt: Date;
}

const ExperimentRunSchema = new Schema<IExperimentRun>({
  modelId: { type: String, required: true, index: true },
  modelName: { type: String, required: true },
  datasetId: { type: String, required: true, index: true },
  datasetName: { type: String, required: true },
  seed: { type: Number, required: true, index: true },
  bestEpoch: { type: Number, default: 0 },
  bestScore: { type: Number },
  durationSeconds: { type: Number },
  finalMetrics: { type: Schema.Types.Mixed, required: true },
  history: [
    {
      epoch: { type: Number, required: true },
      metrics: { type: Schema.Types.Mixed, default: {} },
      losses: { type: Schema.Types.Mixed, default: {} },
    },
  ],
  visualizations: {
    umap: { type: String },
    groundTruth: { type: String },
    prediction: { type: String },
    spatialMap: { type: String },
    violin: { type: String },
    customPlots: { type: Schema.Types.Mixed },
  },
  embeddingsData: {
    umapCoordinates: { type: Schema.Types.Mixed },
    spatialCoordinates: { type: Schema.Types.Mixed },
    predictedLabels: { type: Schema.Types.Mixed },
    groundTruthLabels: { type: Schema.Types.Mixed },
    sampleSilhouettes: { type: Schema.Types.Mixed },
  },
  createdAt: { type: Date, default: Date.now },
});

// Composite index to avoid duplicate seed runs for the same model and dataset
ExperimentRunSchema.index({ modelId: 1, datasetId: 1, seed: 1 }, { unique: true });

export const ModelModel: Model<IModel> = mongoose.models.Model || mongoose.model<IModel>('Model', ModelSchema);
export const ExperimentRunModel: Model<IExperimentRun> = mongoose.models.ExperimentRun || mongoose.model<IExperimentRun>('ExperimentRun', ExperimentRunSchema);
