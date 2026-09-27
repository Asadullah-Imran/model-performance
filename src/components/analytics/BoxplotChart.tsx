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
import { Box } from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';
import { calculateQuartiles } from '@/lib/statistics';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export function BoxplotChart() {
  const { models, resultsByModel, selectedMetric, theme } = useDashboard();
  const isDark = theme === 'dark';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
  const textColor = isDark ? '#94a3b8' : '#475569';
  const strokeColor = isDark ? '#e2e8f0' : '#1e293b';

  const modelLabels = models.map(m => m.name);

  // Compute stats (min, q1, median, q3, max) for each model
  const stats = useMemo(() => {
    return models.map(model => {
      const values = resultsByModel[model.id]?.aggregatedMetrics?.[selectedMetric]?.values || [];
      return calculateQuartiles(values);
    });
  }, [models, resultsByModel, selectedMetric]);

  // Determine seed count for subtitle
  const seedCounts = models.map(m => resultsByModel[m.id]?.aggregatedMetrics?.[selectedMetric]?.values?.length || 0);
  const avgSeedCount = seedCounts.length > 0 && Math.max(...seedCounts) > 0 ? Math.max(...seedCounts) : 20;

  // Y-axis scaling bounds
  const validMins = stats.map(s => s.min).filter(v => typeof v === 'number' && !isNaN(v) && v > 0);
  const validMaxs = stats.map(s => s.max).filter(v => typeof v === 'number' && !isNaN(v) && v > 0);
  const minVal = validMins.length > 0 ? Math.min(...validMins) : 0;
  const maxVal = validMaxs.length > 0 ? Math.max(...validMaxs) : 0.4;
  const range = maxVal - minVal || 0.1;
  const suggestedMin = Math.max(0, Number((minVal - range * 0.35).toFixed(3)));
  const suggestedMax = Number((maxVal + range * 0.35).toFixed(3));

  // Custom Chart.js plugin to draw split-tone box-and-whisker plots
  const boxplotPlugin: Plugin = useMemo(() => ({
    id: 'customBoxplotPlugin',
    afterDatasetsDraw(chart: any) {
      const { ctx, scales: { x: xScale, y: yScale } } = chart;
      if (!xScale || !yScale) return;

      const boxWidth = 36;
      const capWidth = 22;
      const topColor = '#9b7bf7';   // Pastel Purple (Median -> Q3)
      const bottomColor = '#5cdbb5'; // Soft Mint Emerald (Q1 -> Median)

      stats.forEach((q, i) => {
        if (!q || isNaN(q.median) || (q.min === 0 && q.max === 0)) return;

        const x = xScale.getPixelForValue(i);
        const yMax = yScale.getPixelForValue(q.max);
        const yQ3 = yScale.getPixelForValue(q.q3);
        const yMedian = yScale.getPixelForValue(q.median);
        const yQ1 = yScale.getPixelForValue(q.q1);
        const yMin = yScale.getPixelForValue(q.min);

        ctx.save();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = strokeColor;

        // 1. Upper Whisker & Cap (Q3 -> Max)
        ctx.beginPath();
        ctx.moveTo(x, yQ3);
        ctx.lineTo(x, yMax);
        ctx.moveTo(x - capWidth / 2, yMax);
        ctx.lineTo(x + capWidth / 2, yMax);
        ctx.stroke();

        // 2. Lower Whisker & Cap (Min -> Q1)
        ctx.beginPath();
        ctx.moveTo(x, yQ1);
        ctx.lineTo(x, yMin);
        ctx.moveTo(x - capWidth / 2, yMin);
        ctx.lineTo(x + capWidth / 2, yMin);
        ctx.stroke();

        // 3. Top Box (Median to Q3)
        const topHeight = Math.max(Math.abs(yMedian - yQ3), 1);
        ctx.fillStyle = topColor;
        ctx.fillRect(x - boxWidth / 2, Math.min(yQ3, yMedian), boxWidth, topHeight);

        // 4. Bottom Box (Q1 to Median)
        const bottomHeight = Math.max(Math.abs(yQ1 - yMedian), 1);
        ctx.fillStyle = bottomColor;
        ctx.fillRect(x - boxWidth / 2, Math.min(yMedian, yQ1), boxWidth, bottomHeight);

        // 5. Box Outline
        const totalHeight = Math.max(Math.abs(yQ1 - yQ3), 2);
        ctx.strokeRect(x - boxWidth / 2, Math.min(yQ3, yQ1), boxWidth, totalHeight);

        // 6. Median Dividing Line
        ctx.beginPath();
        ctx.moveTo(x - boxWidth / 2, yMedian);
        ctx.lineTo(x + boxWidth / 2, yMedian);
        ctx.stroke();

        ctx.restore();
      });
    },
  }), [stats, strokeColor]);

  // Chart dummy data to anchor scales and tooltip triggers
  const chartData = {
    labels: modelLabels,
    datasets: [
      {
        label: selectedMetric,
        data: stats.map(s => s.median),
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        borderWidth: 0,
        hoverBackgroundColor: 'transparent',
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
          title: (items: any) => models[items[0].dataIndex]?.name || '',
          label: (item: any) => `Median: ${stats[item.dataIndex]?.median?.toFixed(4)}`,
          afterBody: (items: any) => {
            const q = stats[items[0].dataIndex];
            if (!q) return [];
            return [
              `Max: ${q.max.toFixed(4)}`,
              `Q3 (75%): ${q.q3.toFixed(4)}`,
              `Median: ${q.median.toFixed(4)}`,
              `Q1 (25%): ${q.q1.toFixed(4)}`,
              `Min: ${q.min.toFixed(4)}`,
              `IQR: ${(q.q3 - q.q1).toFixed(4)}`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: textColor, font: { family: 'Inter', size: 12, weight: '600' } },
      },
      y: {
        suggestedMin,
        suggestedMax,
        title: {
          display: true,
          text: selectedMetric,
          color: textColor,
          font: { family: 'Inter', size: 12, weight: 'bold' },
        },
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
          <Box className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-heading font-bold text-[var(--text-primary)]">
            Seed Score Distributions
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            Spread of {selectedMetric} scores across {avgSeedCount} random seeds
          </p>
        </div>
      </div>
      <div className="flex-1 min-h-[300px]">
        <Bar data={chartData} options={options as any} plugins={[boxplotPlugin]} />
      </div>
    </div>
  );
}

