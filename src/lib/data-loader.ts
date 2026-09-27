import {
  ModelMetadata,
  DatasetInfo,
  MetricDefinition,
  ModelDatasetResults,
  SeedExperimentData,
  RawEvaluationRecord,
} from '@/types';
import {
  DATASET_REGISTRY,
  METRIC_REGISTRY,
  generateModelColorTheme,
  resolveModelColorTheme,
} from './registry';
import {
  calculateMean,
  calculateMedian,
  calculateStdDev,
  calculateSEM,
  calculateCV,
} from './statistics';

/**
 * Aggregates a list of raw experiment run documents into ModelDatasetResults.
 */
export function aggregateExperimentRuns(
  runs: any[],
  modelsList: ModelMetadata[] = [],
  selectedDatasetId: string = 'all'
): {
  models: ModelMetadata[];
  datasets: DatasetInfo[];
  metrics: MetricDefinition[];
  resultsByModel: Record<string, ModelDatasetResults>;
  rawRecords: RawEvaluationRecord[];
} {
  const datasets = DATASET_REGISTRY;
  const metrics = METRIC_REGISTRY;

  // Build model map from provided list with distinct signature color themes
  const modelMap: Record<string, ModelMetadata> = {};
  modelsList.forEach((m, idx) => {
    // Check if the color is missing or the generic default blue
    const isGenericDefault = !m.colorTheme || m.colorTheme.baseColor === 'hsl(215, 90%, 55%)';
    modelMap[m.id] = {
      ...m,
      colorTheme: isGenericDefault ? resolveModelColorTheme(m.id, m.name, idx) : m.colorTheme,
    };
  });

  const resultsByModel: Record<string, ModelDatasetResults> = {};
  const rawRecords: RawEvaluationRecord[] = [];

  // Filter runs if a specific dataset is selected
  const targetRuns = selectedDatasetId === 'all'
    ? runs
    : runs.filter(r => r.datasetId === selectedDatasetId);

  // Group runs by modelId
  const runsByModelId: Record<string, any[]> = {};
  targetRuns.forEach((run, idx) => {
    const modelId = run.modelId;
    if (!runsByModelId[modelId]) {
      runsByModelId[modelId] = [];
    }
    runsByModelId[modelId].push(run);

    // If model wasn't registered in metadata, dynamically construct it from run
    if (!modelMap[modelId]) {
      modelMap[modelId] = {
        id: modelId,
        name: run.modelName || modelId,
        version: 'v1.0',
        description: 'Auto-registered model from experiment pipeline',
        architecture: 'Deep Learning Model',
        hyperparameters: {},
        colorTheme: resolveModelColorTheme(modelId, run.modelName || modelId, Object.keys(modelMap).length),
      };
    }

    rawRecords.push({
      modelId: run.modelId,
      modelName: run.modelName || run.modelId,
      datasetId: run.datasetId,
      datasetName: run.datasetName || run.datasetId,
      seed: run.seed,
      metrics: run.finalMetrics || {},
      bestEpoch: run.bestEpoch,
    });
  });

  // Calculate aggregations for each model that has runs
  Object.keys(runsByModelId).forEach(modelId => {
    const modelRuns = runsByModelId[modelId];
    const seedsData: Record<number, SeedExperimentData> = {};
    const metricValuesAccumulator: Record<string, number[]> = {};

    metrics.forEach(m => {
      metricValuesAccumulator[m.key] = [];
    });

    modelRuns.forEach(run => {
      seedsData[run.seed] = {
        seed: run.seed,
        modelId: run.modelId,
        datasetId: run.datasetId,
        bestEpoch: run.bestEpoch || 0,
        bestScore: run.bestScore || 0,
        durationSeconds: run.durationSeconds,
        finalMetrics: run.finalMetrics || {},
        history: run.history || [],
        visualizations: run.visualizations || {},
        embeddingsData: run.embeddingsData || {},
      };

      metrics.forEach(m => {
        const val = run.finalMetrics?.[m.key];
        if (typeof val === 'number' && !isNaN(val)) {
          metricValuesAccumulator[m.key].push(val);
        }
      });
    });

    const aggregatedMetrics: ModelDatasetResults['aggregatedMetrics'] = {};

    metrics.forEach(m => {
      const values = metricValuesAccumulator[m.key] || [];
      const mean = calculateMean(values);
      const median = calculateMedian(values);
      const stdDev = calculateStdDev(values);
      const sem = calculateSEM(values);
      const cv = calculateCV(values);
      const min = values.length > 0 ? Math.min(...values) : 0;
      const max = values.length > 0 ? Math.max(...values) : 0;
      const range = max - min;

      aggregatedMetrics[m.key] = {
        mean: Number(mean.toFixed(4)),
        median: Number(median.toFixed(4)),
        stdDev: Number(stdDev.toFixed(4)),
        sem: Number(sem.toFixed(4)),
        cv: Number(cv.toFixed(2)),
        min: Number(min.toFixed(4)),
        max: Number(max.toFixed(4)),
        range: Number(range.toFixed(4)),
        values,
      };
    });

    resultsByModel[modelId] = {
      modelId,
      datasetId: selectedDatasetId,
      seeds: seedsData,
      aggregatedMetrics,
    };
  });

  const finalModelsList = Object.values(modelMap);

  return {
    models: finalModelsList,
    datasets,
    metrics,
    resultsByModel,
    rawRecords,
  };
}
