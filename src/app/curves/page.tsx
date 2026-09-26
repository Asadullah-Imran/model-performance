'use client';

import React, { useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { TrendingUp, Layers, Activity, Cpu } from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';
import { calculateMean, calculateSEM } from '@/lib/statistics';
import { LOSS_REGISTRY } from '@/lib/registry';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function CurvesPage() {
  const { models, resultsByModel, theme } = useDashboard();
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [curveMetric, setCurveMetric] = useState<string>('ARI');
  const [showAllSeeds, setShowAllSeeds] = useState<boolean>(true);

  const isDark = theme === 'dark';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  const selectedModel = models.find(m => m.id === selectedModelId) || models[0];
  const modelSeedsData = selectedModel ? resultsByModel[selectedModel.id]?.seeds || {} : {};
  const seedList = Object.values(modelSeedsData);

  // Extract epoch labels from the first seed history
  const epochLabels = (seedList[0]?.history || []).map(h => `Ep ${h.epoch}`);

  // Metric Curve with SEM shaded ribbon
  const metricChartData = useMemo(() => {
    if (seedList.length === 0 || !selectedModel) return { labels: [], datasets: [] };

    const epochsCount = seedList[0]?.history?.length || 0;
    const meanValues: number[] = [];
    const upperSEM: number[] = [];
    const lowerSEM: number[] = [];

    for (let i = 0; i < epochsCount; i++) {
      const valsAtEpoch = seedList.map(s => s.history[i]?.metrics[curveMetric] ?? 0);
      const mean = calculateMean(valsAtEpoch);
      const sem = calculateSEM(valsAtEpoch);
      meanValues.push(Number(mean.toFixed(4)));
      upperSEM.push(Number((mean + sem).toFixed(4)));
      lowerSEM.push(Number((mean - sem).toFixed(4)));
    }

    const datasets: any[] = [];

    // Individual seed traces
    if (showAllSeeds) {
      seedList.slice(0, 8).forEach((seedData, idx) => {
        const seedVals = seedData.history.map(h => h.metrics[curveMetric] ?? 0);
        datasets.push({
          label: `Seed ${seedData.seed}`,
          data: seedVals,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
          borderWidth: 1,
          pointRadius: 0,
          tension: 0.3,
          fill: false,
        });
      });
    }

    // Upper SEM bound (invisible line)
    datasets.push({
      label: '+1 SEM Bound',
      data: upperSEM,
      borderColor: 'transparent',
      backgroundColor: 'transparent',
      pointRadius: 0,
      fill: false,
    });

    // Lower SEM bound with fill to upper
    datasets.push({
      label: '±1 SEM Region',
      data: lowerSEM,
      borderColor: 'transparent',
      backgroundColor: selectedModel?.colorTheme?.glowColor || 'rgba(99, 102, 241, 0.2)',
      pointRadius: 0,
      fill: '-1',
    });

    // Mean curve line
    datasets.push({
      label: `Mean ${curveMetric} (${selectedModel?.name || ''})`,
      data: meanValues,
      borderColor: selectedModel?.colorTheme?.baseColor || '#6366f1',
      backgroundColor: selectedModel?.colorTheme?.baseColor || '#6366f1',
      borderWidth: 3,
      pointRadius: 2,
      pointHoverRadius: 5,
      tension: 0.3,
      fill: false,
    });

    return {
      labels: epochLabels,
      datasets,
    };
  }, [seedList, curveMetric, showAllSeeds, selectedModel, epochLabels, isDark]);

  // Multi-Loss Decomposition Chart Data
  const lossChartData = useMemo(() => {
    if (seedList.length === 0) return { labels: [], datasets: [] };

    const epochsCount = seedList[0]?.history?.length || 0;
    const lossComponents = ['total_loss', 'reconstruction_loss', 'spatial_loss', 'reg_loss'];

    const datasets = lossComponents.map(lossKey => {
      const def = LOSS_REGISTRY.find(l => l.key === lossKey) || {
        name: lossKey,
        color: '#6366f1',
      };

      const meanLosses: number[] = [];
      for (let i = 0; i < epochsCount; i++) {
        const vals = seedList.map(s => s.history[i]?.losses[lossKey] ?? 0);
        meanLosses.push(Number(calculateMean(vals).toFixed(4)));
      }

      return {
        label: def.name,
        data: meanLosses,
        borderColor: def.color,
        backgroundColor: def.color,
        borderWidth: lossKey === 'total_loss' ? 3 : 1.8,
        pointRadius: 0,
        tension: 0.3,
      };
    });

    return {
      labels: epochLabels,
      datasets,
    };
  }, [seedList, epochLabels]);

  if (models.length === 0 || !selectedModel) {
    return (
      <div className="p-8 rounded-3xl bg-[var(--bg-secondary)] border border-dashed border-[var(--border-color)] text-center space-y-3">
        <TrendingUp className="w-8 h-8 text-indigo-400 mx-auto" />
        <h3 className="font-heading font-bold text-base text-[var(--text-primary)]">
          No Training Curves Available
        </h3>
        <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
          Training dynamics and multi-loss decomposition curves will appear here as soon as you run your Python training script.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Model and Metric Filter Bar */}
      <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase">Model:</span>
            <select
              value={selectedModel?.id || ''}
              onChange={e => setSelectedModelId(e.target.value)}
              className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs font-semibold rounded-xl px-3 py-1.5 focus:outline-none"
            >
              {models.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase">Metric:</span>
            <div className="flex items-center gap-1">
              {['ARI', 'Silhouette', 'NMI'].map(mKey => (
                <button
                  key={mKey}
                  onClick={() => setCurveMetric(mKey)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    curveMetric === mKey
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {mKey}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-[var(--text-muted)] font-medium flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showAllSeeds}
              onChange={e => setShowAllSeeds(e.target.checked)}
              className="rounded accent-indigo-600 cursor-pointer"
            />
            Show Individual Seed Overlay
          </label>
        </div>
      </div>

      {/* Grid: 2 Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Metric vs Epoch with SEM Ribbon */}
        <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 shadow-sm flex flex-col">
          <div className="mb-4">
            <h3 className="text-base font-heading font-bold text-[var(--text-primary)] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              {curveMetric} vs Training Epoch (Mean ± SEM)
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Trajectory of clustering metric across training epochs with confidence ribbon
            </p>
          </div>

          <div className="flex-1 min-h-[320px]">
            {seedList.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-[var(--text-muted)]">
                No epoch logs for {selectedModel?.name} yet
              </div>
            ) : (
              <Line
                data={metricChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: { color: textColor, font: { size: 10 }, usePointStyle: true },
                    },
                  },
                  scales: {
                    x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 9 }, maxTicksLimit: 12 } },
                    y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10 } } },
                  },
                }}
              />
            )}
          </div>
        </div>

        {/* Multi-Loss Decomposition vs Epoch */}
        <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 shadow-sm flex flex-col">
          <div className="mb-4">
            <h3 className="text-base font-heading font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Multi-Loss Component Decomposition
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Total, Reconstruction, Spatial Regularization, and Regularization penalty trajectories
            </p>
          </div>

          <div className="flex-1 min-h-[320px]">
            {seedList.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-[var(--text-muted)]">
                No loss histories for {selectedModel?.name} yet
              </div>
            ) : (
              <Line
                data={lossChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: { color: textColor, font: { size: 10 }, usePointStyle: true },
                    },
                  },
                  scales: {
                    x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 9 }, maxTicksLimit: 12 } },
                    y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10 } } },
                  },
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
