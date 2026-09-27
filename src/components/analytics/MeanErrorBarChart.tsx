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
import { BarChart3 } from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export function MeanErrorBarChart() {
  const { models, resultsByModel, selectedMetric, theme } = useDashboard();
  const isDark = theme === 'dark';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const labelTextColor = isDark ? '#f8fafc' : '#0f172a';

  const labels = models.map(m => m.name);
  const means = models.map(m => resultsByModel[m.id]?.aggregatedMetrics?.[selectedMetric]?.mean ?? 0);
  const sems = models.map(m => resultsByModel[m.id]?.aggregatedMetrics?.[selectedMetric]?.sem ?? 0);
  const stdDevs = models.map(m => resultsByModel[m.id]?.aggregatedMetrics?.[selectedMetric]?.stdDev ?? 0);

  const maxMean = Math.max(...means, 0);
  const suggestedMax = maxMean > 0 ? maxMean * 1.22 : 0.4;

  const chartData = {
    labels,
    datasets: [
      {
        label: `Mean ${selectedMetric}`,
        data: means,
        backgroundColor: models.map(m => m.colorTheme.baseColor),
        borderRadius: 6,
        maxBarThickness: 56,
      },
    ],
  };

  // Custom inline plugin to render numeric mean score above each bar
  const topDataLabelsPlugin: Plugin = useMemo(() => ({
    id: 'topDataLabelsPlugin',
    afterDatasetsDraw(chart: any) {
      const { ctx, data } = chart;
      ctx.save();
      const meta = chart.getDatasetMeta(0);
      meta.data.forEach((bar: any, index: number) => {
        const val = data.datasets[0].data[index];
        if (val !== undefined && val !== null && !isNaN(val)) {
          const text = Number(val).toFixed(4);
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.fillStyle = labelTextColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(text, bar.x, Math.max(bar.y - 5, 14));
        }
      });
      ctx.restore();
    },
  }), [labelTextColor]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => `Mean ${selectedMetric}: ${context.parsed.y.toFixed(4)}`,
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
        grid: { display: false },
        ticks: { color: textColor, font: { family: 'Inter', size: 11, weight: '500' } },
      },
      y: {
        suggestedMax,
        grid: { color: gridColor },
        ticks: { 
          color: textColor, 
          font: { family: 'Inter', size: 11 },
          callback: (value: any) => Number(value).toFixed(3),
        },
      },
    },
  };

  return (
    <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 shadow-sm flex flex-col h-full">
      <div className="flex items-start gap-2.5 mb-4">
        <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500 mt-0.5">
          <BarChart3 className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-base font-heading font-bold text-[var(--text-primary)]">
            Mean Performance & Standard Error
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            Bar chart representation of models performance with std deviation error bounds
          </p>
        </div>
      </div>
      <div className="flex-1 min-h-[280px]">
        <Bar data={chartData} options={options as any} plugins={[topDataLabelsPlugin]} />
      </div>
    </div>
  );
}

