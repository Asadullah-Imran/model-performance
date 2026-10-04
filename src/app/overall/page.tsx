'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  Trophy,
  Layers,
  Database,
  Award,
  Sparkles,
  TrendingUp,
  RefreshCw,
  Info,
} from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';
import { DATASET_REGISTRY, METRIC_REGISTRY } from '@/lib/registry';
import { aggregateAllDatasetsResults } from '@/lib/data-loader';
import { OverallFilterBar, LayoutMode, SeedMode } from '@/components/overall/OverallFilterBar';
import { DatasetBarCard } from '@/components/overall/DatasetBarCard';
import { MacroGroupedBarChart } from '@/components/overall/MacroGroupedBarChart';
import { OverallMatrixTable } from '@/components/overall/OverallMatrixTable';

export default function OverallPerformancePage() {
  const {
    models: contextModels,
    theme,
    selectedModelIds: contextSelectedModelIds,
    toggleModelFilter: contextToggleModelFilter,
    selectAllModels: contextSelectAllModels,
    deselectAllModels: contextDeselectAllModels,
  } = useDashboard();

  const [selectedMetric, setSelectedMetric] = useState<string>('ARI');
  const [seedMode, setSeedMode] = useState<SeedMode>('mean');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid');
  const [sortByScore, setSortByScore] = useState<boolean>(true);

  const [allRuns, setAllRuns] = useState<any[]>([]);
  const [isLoadingRuns, setIsLoadingRuns] = useState<boolean>(true);

  // Fetch all experiments runs across all datasets for a complete global benchmark
  useEffect(() => {
    let isMounted = true;
    setIsLoadingRuns(true);

    fetch('/api/experiments?datasetId=all')
      .then(res => res.json())
      .then(json => {
        if (isMounted && json.runs) {
          setAllRuns(json.runs);
        }
      })
      .catch(err => {
        console.error('Failed to load all datasets experiments:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingRuns(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Compute dataset-wise aggregations
  const aggregatedData = useMemo(() => {
    return aggregateAllDatasetsResults(allRuns, contextModels, selectedMetric);
  }, [allRuns, contextModels, selectedMetric]);

  const { datasets, datasetResults, models, globalModelAverages } = aggregatedData;

  const activeMetricDef = useMemo(() => {
    return METRIC_REGISTRY.find(m => m.key === selectedMetric) || METRIC_REGISTRY[0];
  }, [selectedMetric]);

  const isHigherBetter = activeMetricDef.direction === 'higher_is_better';

  // Overall benchmark winner across all datasets
  const globalWinner = useMemo(() => {
    if (models.length === 0) return null;
    const entries = Object.entries(globalModelAverages).filter(([_, val]) => val.datasetCount > 0);
    if (entries.length === 0) return null;

    entries.sort((a, b) => isHigherBetter ? b[1].mean - a[1].mean : a[1].mean - b[1].mean);
    const winnerId = entries[0][0];
    const winnerModel = models.find(m => m.id === winnerId);
    const winnerScore = entries[0][1].mean;
    const secondScore = entries[1] ? entries[1][1].mean : null;
    const margin = secondScore !== null ? Math.max(0, isHigherBetter ? winnerScore - secondScore : secondScore - winnerScore) : 0;

    return {
      model: winnerModel,
      score: winnerScore,
      margin,
      datasetsCount: entries[0][1].datasetCount,
    };
  }, [models, globalModelAverages, isHigherBetter]);

  const selectedModelIds = contextSelectedModelIds.length > 0
    ? contextSelectedModelIds
    : models.map(m => m.id);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Metric Badge Card */}
        <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Active Metric
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-heading font-bold text-[var(--text-primary)]">
                {activeMetricDef.shortName || activeMetricDef.key}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isHigherBetter
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
              }`}>
                {isHigherBetter ? 'Higher is better' : 'Lower is better'}
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center">
            <BarChart3 className="w-5 h-5" />
          </div>
        </div>

        {/* Global Benchmark Winner */}
        <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Benchmark Winner
            </span>
            {globalWinner?.model ? (
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                  style={{ backgroundColor: globalWinner.model.colorTheme?.baseColor || '#6366f1' }}
                />
                <span className="text-base font-heading font-bold text-[var(--text-primary)] truncate max-w-[130px]">
                  {globalWinner.model.name}
                </span>
                <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {globalWinner.score.toFixed(4)}
                </span>
              </div>
            ) : (
              <span className="text-xs text-[var(--text-muted)]">Calculating...</span>
            )}
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
            <Trophy className="w-5 h-5" />
          </div>
        </div>

        {/* Total Datasets Covered */}
        <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Evaluated Datasets
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-heading font-bold text-[var(--text-primary)]">
                {datasets.length} Datasets
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                Multi-Omics
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
        </div>

        {/* Aggregated Runs Count */}
        <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Total Runs Ingested
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-heading font-bold text-[var(--text-primary)]">
                {allRuns.length} Runs
              </span>
              {isLoadingRuns ? (
                <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Live DB
                </span>
              )}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-500 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Interactive Controls & Filters */}
      <OverallFilterBar
        selectedMetric={selectedMetric}
        onSelectMetric={setSelectedMetric}
        selectedModelIds={selectedModelIds}
        onToggleModel={contextToggleModelFilter}
        onSelectAllModels={contextSelectAllModels}
        onDeselectAllModels={contextDeselectAllModels}
        seedMode={seedMode}
        onSelectSeedMode={setSeedMode}
        layoutMode={layoutMode}
        onSelectLayoutMode={setLayoutMode}
        sortByScore={sortByScore}
        onToggleSortByScore={() => setSortByScore(prev => !prev)}
      />

      {/* Main Content Area */}
      {layoutMode === 'macro' && (
        <MacroGroupedBarChart
          datasets={datasets}
          models={models}
          selectedModelIds={selectedModelIds}
          datasetResults={datasetResults}
          selectedMetric={selectedMetric}
          seedMode={seedMode}
          theme={theme}
        />
      )}

      {layoutMode === 'table' && (
        <OverallMatrixTable
          datasets={datasets}
          models={models}
          selectedModelIds={selectedModelIds}
          datasetResults={datasetResults}
          selectedMetric={selectedMetric}
          seedMode={seedMode}
        />
      )}

      {layoutMode === 'grid' && (
        <div className="space-y-8">
          {/* Section Heading */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-heading font-bold text-[var(--text-primary)] flex items-center gap-2">
                <span>Dataset-Wise Performance Bar Charts</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-semibold">
                  {selectedMetric} Evaluation
                </span>
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Individual bar chart for every dataset comparing all {selectedModelIds.length} models side-by-side
              </p>
            </div>
            <span className="text-xs text-[var(--text-muted)] font-medium">
              Showing {datasets.length} benchmark datasets
            </span>
          </div>

          {/* Responsive Grid of Dataset Bar Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {datasets.map(dataset => {
              const dsRes = datasetResults[dataset.id];
              return (
                <DatasetBarCard
                  key={dataset.id}
                  dataset={dataset}
                  models={models}
                  selectedModelIds={selectedModelIds}
                  resultsByModel={dsRes?.resultsByModel || {}}
                  selectedMetric={selectedMetric}
                  seedMode={seedMode}
                  sortByScore={sortByScore}
                  theme={theme}
                />
              );
            })}
          </div>

          {/* Quick Matrix Overview at bottom of Grid view */}
          <div className="pt-4">
            <OverallMatrixTable
              datasets={datasets}
              models={models}
              selectedModelIds={selectedModelIds}
              datasetResults={datasetResults}
              selectedMetric={selectedMetric}
              seedMode={seedMode}
            />
          </div>
        </div>
      )}
    </div>
  );
}
