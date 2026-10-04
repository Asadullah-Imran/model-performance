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
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { Layers, Sparkles, BarChart2 } from 'lucide-react';
import { DatasetInfo, ModelMetadata, ModelDatasetResults } from '@/types';
import { METRIC_REGISTRY } from '@/lib/registry';
import { SeedMode } from './OverallFilterBar';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface MacroGroupedBarChartProps {
  datasets: DatasetInfo[];
  models: ModelMetadata[];
  selectedModelIds: string[];
  datasetResults: Record<string, { resultsByModel: Record<string, ModelDatasetResults> }>;
  selectedMetric: string;
  seedMode: SeedMode;
  theme: 'light' | 'dark';
}

export function MacroGroupedBarChart({
  datasets,
  models,
  selectedModelIds,
  datasetResults,
  selectedMetric,
  seedMode,
  theme,
}: MacroGroupedBarChartProps) {
  const isDark = theme === 'dark';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const labelTextColor = isDark ? '#f8fafc' : '#0f172a';

  const metricDef = METRIC_REGISTRY.find(m => m.key === selectedMetric) || METRIC_REGISTRY[0];
  const higherIsBetter = metricDef.direction === 'higher_is_better';

  const activeModels = useMemo(() => {
    const list = models.filter(m => selectedModelIds.includes(m.id));
    return list.length > 0 ? list : models;
  }, [models, selectedModelIds]);

  // Labels on X axis: dataset short names
  const datasetLabels = useMemo(() => {
    return datasets.map(d => {
      // Clean up dataset names for concise x-axis labels
      return d.name.replace('10x Human Lymph Node ', 'Lymph Node ').replace('Mouse Brain ', 'Mouse ');
    });
  }, [datasets]);

  // Datasets per model
  const chartDatasets = useMemo(() => {
    return activeModels.map(model => {
      const color = model.colorTheme?.baseColor || '#6366f1';

      const data = datasets.map(ds => {
        const dsRes = datasetResults[ds.id];
        const res = dsRes?.resultsByModel?.[model.id];
        if (!res) return 0;

        if (seedMode === 'mean') {
          return res.aggregatedMetrics?.[selectedMetric]?.mean ?? 0;
        }
        if (seedMode === 'seed_42' || seedMode === 'seed_2024') {
          const targetSeed = seedMode === 'seed_42' ? 42 : 2024;
          return res.seeds?.[targetSeed]?.finalMetrics?.[selectedMetric] ?? 0;
        }
        if (seedMode === 'best') {
          const vals = Object.values(res.seeds || {})
            .map(s => s.finalMetrics?.[selectedMetric])
            .filter((v): v is number => typeof v === 'number' && !isNaN(v));
          return vals.length > 0 ? (higherIsBetter ? Math.max(...vals) : Math.min(...vals)) : 0;
        }
        return 0;
      });

      return {
        label: model.name,
        data,
        backgroundColor: color,
        borderRadius: 5,
        maxBarThickness: 32,
      };
    });
  }, [activeModels, datasets, datasetResults, selectedMetric, seedMode, higherIsBetter]);

  const allValues = chartDatasets.flatMap(d => d.data);
  const maxVal = Math.max(...allValues, 0);
  const suggestedMax = maxVal > 0 ? maxVal * 1.2 : 0.5;

  const chartData = {
    labels: datasetLabels,
    datasets: chartDatasets,
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: textColor,
          font: { family: 'Inter', size: 12, weight: '500' },
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 16,
        },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => `${context.dataset.label}: ${context.parsed.y.toFixed(4)}`,
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
          font: { family: 'Inter', size: 11 },
          callback: (val: any) => Number(val).toFixed(2),
        },
      },
    },
  };

  return (
    <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6 border-b border-[var(--border-color)]/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
              <BarChart2 className="w-4 h-4" />
            </div>
            <h3 className="text-base font-heading font-bold text-[var(--text-primary)]">
              Cross-Dataset Comparative Overview ({selectedMetric})
            </h3>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Grouped side-by-side performance for all models across all benchmark datasets in a single unified view
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)] font-medium">
            Active Mode: <strong className="text-[var(--text-primary)]">{seedMode === 'mean' ? 'Mean across seeds' : seedMode}</strong>
          </span>
        </div>
      </div>

      <div className="h-80 w-full">
        <Bar data={chartData} options={options as any} />
      </div>
    </div>
  );
}
