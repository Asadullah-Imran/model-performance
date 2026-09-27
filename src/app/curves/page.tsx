'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
import { TrendingUp, Layers, Activity, Cpu, RefreshCw } from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';
import { calculateMean, calculateSEM } from '@/lib/statistics';
import { LOSS_REGISTRY } from '@/lib/registry';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function CurvesPage() {
  const { models, resultsByModel, selectedDataset, theme } = useDashboard();
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [curveMetric, setCurveMetric] = useState<string>('ARI');
  const [showAllSeeds, setShowAllSeeds] = useState<boolean>(true);
  const [visibleLosses, setVisibleLosses] = useState<Record<string, boolean>>({
    total_loss: true,
    reconstruction_loss: true,
    spatial_loss: true,
    reg_loss: true,
  });
  const [curvesCache, setCurvesCache] = useState<Record<string, Record<number, any[]>>>({});
  const [isFetchingCurves, setIsFetchingCurves] = useState<boolean>(false);

  const isDark = theme === 'dark';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  const selectedModel = models.find(m => m.id === selectedModelId) || models[0];

  // Tier 2: Fetch epoch trajectories on demand for the selected model
  useEffect(() => {
    if (!selectedModel) return;
    const cacheKey = `${selectedModel.id}_${selectedDataset}`;
    if (curvesCache[cacheKey]) return;

    setIsFetchingCurves(true);
    fetch(`/api/experiments/curves?modelId=${selectedModel.id}&datasetId=${selectedDataset}`)
      .then(res => res.json())
      .then(data => {
        if (data?.runs && Array.isArray(data.runs)) {
          const seedsMap: Record<number, any[]> = {};
          data.runs.forEach((r: any) => {
            if (r.seed !== undefined && r.history) {
              seedsMap[r.seed] = r.history;
            }
          });
          setCurvesCache(prev => ({
            ...prev,
            [cacheKey]: seedsMap,
          }));
        }
      })
      .catch(err => {
        console.error('Failed to load curve history:', err);
      })
      .finally(() => setIsFetchingCurves(false));
  }, [selectedModel?.id, selectedDataset, curvesCache]);

  const currentCurvesMap = selectedModel ? curvesCache[`${selectedModel.id}_${selectedDataset}`] || {} : {};

  // Combine seed summaries with dynamically fetched epoch histories
  const seedList = useMemo(() => {
    if (!selectedModel) return [];
    const baseSeeds = resultsByModel[selectedModel.id]?.seeds || {};
    return Object.values(baseSeeds).map(s => {
      const dynamicHistory = currentCurvesMap[s.seed];
      return {
        ...s,
        history: dynamicHistory && dynamicHistory.length > 0 ? dynamicHistory : (s.history || []),
      };
    });
  }, [selectedModel, resultsByModel, currentCurvesMap]);

  // Extract epoch labels from the first seed history
  const epochLabels = (seedList[0]?.history || []).map(h => `Ep ${h.epoch}`);

  // Robust metric & loss value extractors (supports nested & legacy flat records)
  const getMetricVal = (h: any, key: string) => {
    if (!h) return 0;
    if (h.metrics && h.metrics[key] !== undefined) return h.metrics[key];
    if (key.toLowerCase() === 'ari' && h.ari !== undefined) return h.ari;
    if (key.toLowerCase() === 'silhouette' && h.silhouette !== undefined) return h.silhouette;
    if (key.toLowerCase() === 'nmi' && h.nmi !== undefined) return h.nmi;
    return 0;
  };

  const getLossVal = (h: any, key: string) => {
    if (!h) return 0;
    if (h.losses && h.losses[key] !== undefined) return h.losses[key];
    if (key === 'total_loss' && h.total_loss !== undefined) return h.total_loss;
    return 0;
  };

  // Metric Curve with SEM shaded ribbon
  const metricChartData = useMemo(() => {
    if (seedList.length === 0 || !selectedModel) return { labels: [], datasets: [] };

    const epochsCount = seedList[0]?.history?.length || 0;
    const meanValues: number[] = [];
    const upperSEM: number[] = [];
    const lowerSEM: number[] = [];

    for (let i = 0; i < epochsCount; i++) {
      const valsAtEpoch = seedList.map(s => getMetricVal(s.history[i], curveMetric));
      const mean = calculateMean(valsAtEpoch);
      const sem = calculateSEM(valsAtEpoch);
      meanValues.push(Number(mean.toFixed(4)));
      upperSEM.push(Number((mean + sem).toFixed(4)));
      lowerSEM.push(Number((mean - sem).toFixed(4)));
    }

    const datasets: any[] = [];

    // Individual seed traces
    if (showAllSeeds) {
      seedList.slice(0, 8).forEach((seedData) => {
        const seedVals = seedData.history.map(h => getMetricVal(h, curveMetric));
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
    const lossComponents = ['total_loss', 'reconstruction_loss', 'spatial_loss', 'reg_loss']
      .filter(k => visibleLosses[k] !== false);

    const datasets = lossComponents.map(lossKey => {
      const def = LOSS_REGISTRY.find(l => l.key === lossKey) || {
        name: lossKey,
        color: '#6366f1',
      };

      const meanLosses: number[] = [];
      for (let i = 0; i < epochsCount; i++) {
        const vals = seedList.map(s => getLossVal(s.history[i], lossKey));
        meanLosses.push(Number(calculateMean(vals).toFixed(4)));
      }

      return {
        label: def.name,
        data: meanLosses,
        borderColor: def.color,
        backgroundColor: def.color,
        borderWidth: lossKey === 'total_loss' ? 3 : 2,
        pointRadius: 0,
        tension: 0.3,
      };
    });

    return {
      labels: epochLabels,
      datasets,
    };
  }, [seedList, epochLabels, visibleLosses]);

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

        <div className="flex items-center gap-3">
          {isFetchingCurves && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Loading curves...</span>
            </div>
          )}

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
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-base font-heading font-bold text-[var(--text-primary)] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                {curveMetric} vs Training Epoch (Mean ± SEM)
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Trajectory of clustering metric across training epochs with confidence ribbon
              </p>
            </div>
            {/* Metric Filter Pills */}
            <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] p-1 rounded-xl border border-[var(--border-color)]">
              {['ARI', 'Silhouette', 'NMI', 'AMI', 'Homogeneity'].map(mKey => (
                <button
                  key={mKey}
                  onClick={() => setCurveMetric(mKey)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    curveMetric === mKey
                      ? 'bg-emerald-600 text-white shadow-sm scale-105'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                  }`}
                >
                  {mKey === 'Silhouette' ? 'Sil' : mKey}
                </button>
              ))}
            </div>
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
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-base font-heading font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                Multi-Loss Component Decomposition
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Filter individual loss components and total loss
              </p>
            </div>
          </div>

          {/* Loss Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            {LOSS_REGISTRY.map(loss => {
              const isVisible = visibleLosses[loss.key] !== false;
              return (
                <button
                  key={loss.key}
                  onClick={() =>
                    setVisibleLosses(prev => ({
                      ...prev,
                      [loss.key]: !isVisible,
                    }))
                  }
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
                    isVisible
                      ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--border-color)] shadow-sm'
                      : 'opacity-40 bg-transparent text-[var(--text-muted)] border-dashed border-[var(--border-color)]'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: isVisible ? loss.color : '#64748b' }}
                  />
                  <span>{loss.name}</span>
                </button>
              );
            })}
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
