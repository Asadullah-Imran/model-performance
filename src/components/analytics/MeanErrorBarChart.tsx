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

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export function MeanErrorBarChart() {
  const { models, resultsByModel, selectedMetric, theme } = useDashboard();
  const isDark = theme === 'dark';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  const labels = models.map(m => m.name);
  const means = models.map(m => resultsByModel[m.id]?.aggregatedMetrics?.[selectedMetric]?.mean ?? 0);
  const sems = models.map(m => resultsByModel[m.id]?.aggregatedMetrics?.[selectedMetric]?.sem ?? 0);
  const stdDevs = models.map(m => resultsByModel[m.id]?.aggregatedMetrics?.[selectedMetric]?.stdDev ?? 0);

  const chartData = {
    labels,
    datasets: [
      {
        label: `Mean ${selectedMetric}`,
        data: means,
        backgroundColor: models.map(m => m.colorTheme.baseColor),
        borderRadius: 8,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          afterBody: (context: any) => {
            const idx = context[0].dataIndex;
            return [
              `Std Dev (σ): ±${stdDevs[idx].toFixed(4)}`,
              `Std Error (SEM): ±${sems[idx].toFixed(4)}`,
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
          Mean Performance & Standard Error (SEM)
        </h3>
        <p className="text-xs text-[var(--text-muted)]">
          Aggregated mean across all seeds with standard deviation and standard error of the mean
        </p>
      </div>
      <div className="flex-1 min-h-[280px]">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
}
