'use client';

import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Plugin,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { Trophy, Award, Sparkles, MapPin, Layers, ExternalLink, Activity } from 'lucide-react';
import Link from 'next/link';
import { DatasetInfo, ModelMetadata, ModelDatasetResults } from '@/types';
import { METRIC_REGISTRY } from '@/lib/registry';
import { SeedMode } from './OverallFilterBar';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface DatasetBarCardProps {
  dataset: DatasetInfo;
  models: ModelMetadata[];
  selectedModelIds: string[];
  resultsByModel: Record<string, ModelDatasetResults>;
  selectedMetric: string;
  seedMode: SeedMode;
  sortByScore: boolean;
  theme: 'light' | 'dark';
}

export function DatasetBarCard({
  dataset,
  models,
  selectedModelIds,
  resultsByModel,
  selectedMetric,
  seedMode,
  sortByScore,
  theme,
}: DatasetBarCardProps) {
  const isDark = theme === 'dark';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const labelTextColor = isDark ? '#f8fafc' : '#0f172a';

  const metricDef = METRIC_REGISTRY.find(m => m.key === selectedMetric) || METRIC_REGISTRY[0];
  const higherIsBetter = metricDef.direction === 'higher_is_better';

  // Filter models that are selected in the global filter
  const activeModels = useMemo(() => {
    const list = models.filter(m => selectedModelIds.includes(m.id));
    return list.length > 0 ? list : models;
  }, [models, selectedModelIds]);

  // Extract score for a specific model according to seedMode
  const getModelScore = (modelId: string) => {
    const res = resultsByModel[modelId];
    if (!res) return { score: 0, sem: 0, stdDev: 0, min: 0, max: 0, seedCount: 0, hasData: false };

    if (seedMode === 'mean') {
      const agg = res.aggregatedMetrics?.[selectedMetric];
      if (!agg || agg.mean === undefined || isNaN(agg.mean)) {
        return { score: 0, sem: 0, stdDev: 0, min: 0, max: 0, seedCount: 0, hasData: false };
      }
      return {
        score: agg.mean,
        sem: agg.sem ?? 0,
        stdDev: agg.stdDev ?? 0,
        min: agg.min ?? 0,
        max: agg.max ?? 0,
        seedCount: agg.values?.length ?? Object.keys(res.seeds || {}).length,
        hasData: true,
      };
    }

    if (seedMode === 'seed_42' || seedMode === 'seed_2024') {
      const targetSeed = seedMode === 'seed_42' ? 42 : 2024;
      const seedData = res.seeds?.[targetSeed];
      const val = seedData?.finalMetrics?.[selectedMetric];
      if (val === undefined || isNaN(val)) {
        return { score: 0, sem: 0, stdDev: 0, min: 0, max: 0, seedCount: 0, hasData: false };
      }
      return { score: val, sem: 0, stdDev: 0, min: val, max: val, seedCount: 1, hasData: true };
    }

    if (seedMode === 'best') {
      const allVals = Object.values(res.seeds || {})
        .map(s => s.finalMetrics?.[selectedMetric])
        .filter((v): v is number => typeof v === 'number' && !isNaN(v));

      if (allVals.length === 0) {
        return { score: 0, sem: 0, stdDev: 0, min: 0, max: 0, seedCount: 0, hasData: false };
      }
      const bestVal = higherIsBetter ? Math.max(...allVals) : Math.min(...allVals);
      return { score: bestVal, sem: 0, stdDev: 0, min: Math.min(...allVals), max: Math.max(...allVals), seedCount: allVals.length, hasData: true };
    }

    return { score: 0, sem: 0, stdDev: 0, min: 0, max: 0, seedCount: 0, hasData: false };
  };

  // Build model performance list with optional sorting
  const modelStats = useMemo(() => {
    const list = activeModels.map(model => {
      const stats = getModelScore(model.id);
      return {
        model,
        ...stats,
      };
    });

    if (sortByScore) {
      list.sort((a, b) => {
        if (!a.hasData && !b.hasData) return 0;
        if (!a.hasData) return 1;
        if (!b.hasData) return -1;
        return higherIsBetter ? b.score - a.score : a.score - b.score;
      });
    }

    return list;
  }, [activeModels, resultsByModel, selectedMetric, seedMode, sortByScore, higherIsBetter]);

  const hasAnyData = modelStats.some(m => m.hasData);

  // Identify winning model
  const winner = useMemo(() => {
    const dataModels = modelStats.filter(m => m.hasData);
    if (dataModels.length === 0) return null;
    const sorted = [...dataModels].sort((a, b) => higherIsBetter ? b.score - a.score : a.score - b.score);
    const first = sorted[0];
    const second = sorted[1];
    const margin = second ? (higherIsBetter ? first.score - second.score : second.score - first.score) : 0;
    return {
      model: first.model,
      score: first.score,
      margin: Math.max(0, margin),
    };
  }, [modelStats, higherIsBetter]);

  const labels = modelStats.map(m => m.model.name);
  const dataValues = modelStats.map(m => m.hasData ? m.score : 0);
  const colors = modelStats.map(m => m.model.colorTheme?.baseColor || '#6366f1');

  const maxVal = Math.max(...dataValues, 0);
  const suggestedMax = maxVal > 0 ? maxVal * 1.25 : 0.5;

  const chartData = {
    labels,
    datasets: [
      {
        label: `${selectedMetric}`,
        data: dataValues,
        backgroundColor: colors,
        borderRadius: 6,
        maxBarThickness: 48,
      },
    ],
  };

  // Custom inline plugin to render numeric score above each bar
  const topDataLabelsPlugin: Plugin = useMemo(() => ({
    id: `topDataLabelsPlugin_${dataset.id}`,
    afterDatasetsDraw(chart: any) {
      const { ctx, data } = chart;
      ctx.save();
      const meta = chart.getDatasetMeta(0);
      meta.data.forEach((bar: any, index: number) => {
        const item = modelStats[index];
        if (item && item.hasData) {
          const text = Number(item.score).toFixed(4);
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.fillStyle = labelTextColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(text, bar.x, Math.max(bar.y - 5, 14));
        }
      });
      ctx.restore();
    },
  }), [labelTextColor, modelStats, dataset.id]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const idx = context.dataIndex;
            const item = modelStats[idx];
            if (!item?.hasData) return 'No runs uploaded';
            return `${selectedMetric}: ${item.score.toFixed(4)}`;
          },
          afterBody: (context: any) => {
            const idx = context[0].dataIndex;
            const item = modelStats[idx];
            if (!item?.hasData) return [];
            if (seedMode === 'mean') {
              return [
                `Std Dev (σ): ±${item.stdDev.toFixed(4)}`,
                `Std Error (SEM): ±${item.sem.toFixed(4)}`,
                `Range: [${item.min.toFixed(4)} - ${item.max.toFixed(4)}]`,
                `Seeds Aggregated: ${item.seedCount}`,
              ];
            }
            return [`Seed Count: ${item.seedCount}`];
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: textColor, font: { family: 'Inter', size: 11, weight: '500' } },
      },
      y: {
        suggestedMax,
        grid: { color: gridColor },
        ticks: {
          color: textColor,
          font: { family: 'Inter', size: 10 },
          callback: (value: any) => Number(value).toFixed(2),
        },
      },
    },
  };

  return (
    <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-5 shadow-sm flex flex-col justify-between transition-all duration-300 hover:shadow-lg hover:border-indigo-500/40 group">
      {/* Card Header */}
      <div>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border-color)]/70 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-heading font-bold text-[var(--text-primary)] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {dataset.name}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-[var(--text-muted)]">
              <span className="px-2 py-0.5 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-color)] font-medium">
                {dataset.type}
              </span>
              <span className="flex items-center gap-1 font-mono">
                <MapPin className="w-3 h-3 text-indigo-500" />
                {dataset.spotsCount.toLocaleString()} spots
              </span>
              <span>•</span>
              <span className="font-mono">{dataset.clustersCount} clusters</span>
            </div>
          </div>

          {/* Winner Badge */}
          {winner && (
            <div className="flex flex-col items-end shrink-0">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-bold shadow-sm">
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                <span>{winner.model.name}</span>
                <span className="font-mono">({winner.score.toFixed(4)})</span>
              </span>
              {winner.margin > 0 && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                  +{winner.margin.toFixed(4)} lead
                </span>
              )}
            </div>
          )}
        </div>

        {/* Bar Chart Area */}
        <div className="h-56 mt-4 relative">
          {hasAnyData ? (
            <Bar data={chartData} options={options as any} plugins={[topDataLabelsPlugin]} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-4 text-center rounded-xl bg-[var(--bg-tertiary)]/30 border border-dashed border-[var(--border-color)]">
              <Activity className="w-6 h-6 text-[var(--text-muted)] mb-1 opacity-50" />
              <p className="text-xs text-[var(--text-muted)]">No experiment runs uploaded for this dataset yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Mini Ranking Footer / Model Comparison Pills */}
      <div className="mt-4 pt-3 border-t border-[var(--border-color)]/70 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {modelStats.map((item, rankIdx) => {
            if (!item.hasData) return null;
            const isFirst = rankIdx === 0 && sortByScore;
            return (
              <div
                key={item.model.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[11px]"
                title={`${item.model.name}: ${item.score.toFixed(4)}`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.model.colorTheme?.baseColor || '#6366f1' }}
                />
                <span className="text-[var(--text-secondary)] font-medium">{item.model.name}</span>
                <span className="font-mono font-bold text-[var(--text-primary)]">
                  {item.score.toFixed(3)}
                </span>
              </div>
            );
          })}
        </div>

        <Link
          href={`/analytics?dataset=${dataset.id}`}
          className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 shrink-0 ml-auto"
        >
          <span>Deep Dive</span>
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
