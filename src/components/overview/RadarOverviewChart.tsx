'use client';

import React from 'react';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';
import { useDashboard } from '@/context/DashboardContext';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export function RadarOverviewChart() {
  const { models, resultsByModel, metrics, theme } = useDashboard();

  // Radar metrics to display
  const radarMetrics = metrics.filter(m => m.key !== 'CHI' && m.key !== 'DBI');

  const isDark = theme === 'dark';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  const datasets = models.slice(0, 5).map(model => {
    const res = resultsByModel[model.id];
    const data = radarMetrics.map(m => {
      const val = res?.aggregatedMetrics?.[m.key]?.mean ?? 0;
      return Number(val.toFixed(3));
    });

    const color = model.colorTheme.baseColor;

    return {
      label: model.name,
      data,
      backgroundColor: color.replace(')', ', 0.15)').replace('hsl', 'hsla'),
      borderColor: color,
      borderWidth: 2,
      pointBackgroundColor: color,
      pointBorderColor: '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: color,
    };
  });

  const chartData = {
    labels: radarMetrics.map(m => m.name),
    datasets,
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        angleLines: { color: gridColor },
        grid: { color: gridColor },
        pointLabels: {
          color: textColor,
          font: {
            family: 'Inter',
            size: 11,
            weight: 500,
          },
        },
        ticks: {
          backdropColor: 'transparent',
          color: textColor,
          font: { size: 9 },
          stepSize: 0.2,
        },
        min: 0,
        max: 1.0,
      },
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: textColor,
          font: { family: 'Inter', size: 11, weight: 500 },
          boxWidth: 12,
          boxHeight: 12,
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: isDark ? 'rgba(19, 25, 43, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        titleColor: isDark ? '#f1f5f9' : '#0f172a',
        bodyColor: isDark ? '#cbd5e1' : '#334155',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
      },
    },
  };

  return (
    <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 shadow-sm flex flex-col h-full">
      <div className="mb-4">
        <h2 className="text-base font-heading font-bold text-[var(--text-primary)]">
          Metrics Trade-off Radar
        </h2>
        <p className="text-xs text-[var(--text-muted)]">
          Multi-dimensional comparison across clustering and spatial coherence dimensions
        </p>
      </div>
      <div className="flex-1 min-h-[300px] w-full flex items-center justify-center">
        <Radar data={chartData} options={options} />
      </div>
    </div>
  );
}
