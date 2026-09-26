'use client';

import React, { useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useDashboard } from '@/context/DashboardContext';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export function SeedCurveChart() {
  const { models, resultsByModel, selectedMetric, theme } = useDashboard();
  const [selectedModelFilter, setSelectedModelFilter] = useState<string>('all');

  const isDark = theme === 'dark';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  // Extract seed labels from first model
  const firstModelId = models[0]?.id;
  const sampleSeeds = Object.keys(resultsByModel[firstModelId]?.seeds || {}).map(s => `Seed ${s}`);

  const activeModels = selectedModelFilter === 'all'
    ? models.slice(0, 5)
    : models.filter(m => m.id === selectedModelFilter);

  const datasets = activeModels.map(model => {
    const seedsObj = resultsByModel[model.id]?.seeds || {};
    const seedValues = Object.values(seedsObj).map(s => s.finalMetrics[selectedMetric] ?? 0);

    return {
      label: model.name,
      data: seedValues,
      borderColor: model.colorTheme.baseColor,
      backgroundColor: model.colorTheme.baseColor,
      pointRadius: 4,
      pointHoverRadius: 6,
      borderWidth: 2,
      tension: 0.3,
    };
  });

  const chartData = {
    labels: sampleSeeds,
    datasets,
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: textColor,
          font: { family: 'Inter', size: 11 },
          usePointStyle: true,
        },
      },
    },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: { color: textColor, font: { family: 'Inter', size: 10 } },
      },
      y: {
        grid: { color: gridColor },
        ticks: { color: textColor, font: { family: 'Inter', size: 10 } },
      },
    },
  };

  return (
    <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 shadow-sm flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-heading font-bold text-[var(--text-primary)]">
            Seed-by-Seed Performance Curve
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            Evaluate seed sensitivity and training consistency across random seeds
          </p>
        </div>
        <select
          value={selectedModelFilter}
          onChange={e => setSelectedModelFilter(e.target.value)}
          className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none"
        >
          <option value="all">Compare All Models</option>
          {models.map(m => (
            <option key={m.id} value={m.id}>
              {m.name} Only
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1 min-h-[280px]">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
