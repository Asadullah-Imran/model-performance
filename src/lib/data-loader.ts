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
  PALETTE_HEXES,
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

  // Track used colors to guarantee zero color collisions across all models
  const usedColors = new Set<string>();
  const modelMap: Record<string, ModelMetadata> = {};

  modelsList.forEach((m, idx) => {
    let canonicalTheme = resolveModelColorTheme(m.id, m.name, idx);

    if (usedColors.has(canonicalTheme.baseColor)) {
      const fallbackHex = PALETTE_HEXES.find(c => !usedColors.has(c)) || PALETTE_HEXES[(idx + 4) % PALETTE_HEXES.length];
      canonicalTheme = {
        ...canonicalTheme,
        baseColor: fallbackHex,
        glowColor: `${fallbackHex}33`,
        bgSoft: `${fallbackHex}14`,
      };
    }
    usedColors.add(canonicalTheme.baseColor);

    modelMap[m.id] = {
      ...m,
      colorTheme: canonicalTheme,
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
      let dynamicTheme = resolveModelColorTheme(modelId, run.modelName || modelId, Object.keys(modelMap).length);
      if (usedColors.has(dynamicTheme.baseColor)) {
        const fallbackHex = PALETTE_HEXES.find(c => !usedColors.has(c)) || PALETTE_HEXES[(Object.keys(modelMap).length + 4) % PALETTE_HEXES.length];
        dynamicTheme = {
          ...dynamicTheme,
          baseColor: fallbackHex,
          glowColor: `${fallbackHex}33`,
          bgSoft: `${fallbackHex}14`,
        };
      }
      usedColors.add(dynamicTheme.baseColor);

      modelMap[modelId] = {
        id: modelId,
        name: run.modelName || modelId,
        version: 'v1.0',
        description: 'Auto-registered model from experiment pipeline',
        architecture: 'Deep Learning Model',
        hyperparameters: {},
        colorTheme: dynamicTheme,
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

export interface DatasetAggregatedResult {
  dataset: DatasetInfo;
  models: ModelMetadata[];
  resultsByModel: Record<string, ModelDatasetResults>;
  bestModelId: string | null;
  bestScore: number | null;
  runsCount: number;
}

/**
 * Aggregates all runs grouped by dataset for cross-dataset overall benchmark analysis.
 */
export function aggregateAllDatasetsResults(
  runs: any[],
  modelsList: ModelMetadata[] = [],
  metricKey: string = 'ARI'
): {
  datasets: DatasetInfo[];
  datasetResults: Record<string, DatasetAggregatedResult>;
  models: ModelMetadata[];
  metrics: MetricDefinition[];
  globalModelAverages: Record<string, { mean: number; datasetCount: number }>;
} {
  const baseAgg = aggregateExperimentRuns(runs, modelsList, 'all');
  const allModels = baseAgg.models;
  const metrics = METRIC_REGISTRY;
  const targetMetric = metrics.find(m => m.key === metricKey) || metrics[0];
  const higherIsBetter = targetMetric.direction === 'higher_is_better';

  // Group raw runs by datasetId
  const runsByDatasetId: Record<string, any[]> = {};
  runs.forEach(run => {
    const dsId = run.datasetId || 'unknown';
    if (!runsByDatasetId[dsId]) {
      runsByDatasetId[dsId] = [];
    }
    runsByDatasetId[dsId].push(run);
  });

  // Ensure all registered datasets are represented, even if some have 0 runs
  const datasetResults: Record<string, DatasetAggregatedResult> = {};
  const activeDatasets: DatasetInfo[] = [];

  DATASET_REGISTRY.forEach(ds => {
    const dsRuns = runsByDatasetId[ds.id] || [];
    const dsAgg = aggregateExperimentRuns(dsRuns, allModels, ds.id);

    let bestModelId: string | null = null;
    let bestScore: number | null = null;

    Object.keys(dsAgg.resultsByModel).forEach(modelId => {
      const score = dsAgg.resultsByModel[modelId]?.aggregatedMetrics?.[metricKey]?.mean;
      if (score !== undefined && typeof score === 'number') {
        if (bestScore === null) {
          bestScore = score;
          bestModelId = modelId;
        } else if (higherIsBetter ? score > bestScore : score < bestScore) {
          bestScore = score;
          bestModelId = modelId;
        }
      }
    });

    datasetResults[ds.id] = {
      dataset: ds,
      models: dsAgg.models,
      resultsByModel: dsAgg.resultsByModel,
      bestModelId,
      bestScore,
      runsCount: dsRuns.length,
    };

    activeDatasets.push(ds);
  });

  // Calculate global average per model across all datasets
  const globalModelAverages: Record<string, { mean: number; datasetCount: number }> = {};
  allModels.forEach(model => {
    let totalScore = 0;
    let count = 0;

    Object.values(datasetResults).forEach(dsResult => {
      const score = dsResult.resultsByModel[model.id]?.aggregatedMetrics?.[metricKey]?.mean;
      if (score !== undefined && typeof score === 'number' && !isNaN(score)) {
        totalScore += score;
        count += 1;
      }
    });

    globalModelAverages[model.id] = {
      mean: count > 0 ? Number((totalScore / count).toFixed(4)) : 0,
      datasetCount: count,
    };
  });

  return {
    datasets: activeDatasets,
    datasetResults,
    models: allModels,
    metrics,
    globalModelAverages,
  };
}

