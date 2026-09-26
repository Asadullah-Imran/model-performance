'use client';

import React from 'react';
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
import { useDashboard } from '@/context/DashboardContext';
import { calculateQuartiles } from '@/lib/statistics';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export function BoxplotChart() {
  const { models, resultsByModel, selectedMetric, metrics, theme } = useDashboard();
  const isDark = theme === 'dark';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  const currentMetricDef = metrics.find(m => m.key === selectedMetric);

  const modelLabels = models.map(m => m.name);
  const medians: number[] = [];
  const minMaxSpans: Array<[number, number]> = [];

  models.forEach(model => {
    const values = resultsByModel[model.id]?.aggregatedMetrics?.[selectedMetric]?.values || [];
    const q = calculateQuartiles(values);
    medians.push(Number(q.median.toFixed(4)));
    minMaxSpans.push([Number(q.min.toFixed(4)), Number(q.max.toFixed(4))]);
  });

  const chartData = {
    labels: modelLabels,
    datasets: [
      {
        label: 'Median ' + selectedMetric,
        data: medians,
        backgroundColor: models.map(m => m.colorTheme.baseColor),
        borderRadius: 8,
        borderWidth: 1,
        borderColor: models.map(m => m.colorTheme.baseColor),
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          afterBody: (context: any) => {
            const idx = context[0].dataIndex;
            const model = models[idx];
            const values = resultsByModel[model.id]?.aggregatedMetrics?.[selectedMetric]?.values || [];
            const q = calculateQuartiles(values);
            return [
              `Max: ${q.max.toFixed(4)}`,
              `Q3: ${q.q3.toFixed(4)}`,
              `Median: ${q.median.toFixed(4)}`,
              `Q1: ${q.q1.toFixed(4)}`,
              `Min: ${q.min.toFixed(4)}`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: { color: textColor, font: { family: 'Inter', size: 11 } },
      },
      y: {
        grid: { color: gridColor },
        ticks: { color: textColor, font: { family: 'Inter', size: 11 } },
      },
    },
  };

  return (
    <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 shadow-sm flex flex-col h-full">
      <div className="mb-4">
        <h3 className="text-base font-heading font-bold text-[var(--text-primary)]">
          {selectedMetric} Score Distributions across Seeds
        </h3>
        <p className="text-xs text-[var(--text-muted)]">
          Spread of scores across random initialization seeds (Min, Q1, Median, Q3, Max)
        </p>
      </div>
      <div className="flex-1 min-h-[280px]">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}
