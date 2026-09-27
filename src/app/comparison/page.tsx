'use client';

import React, { useState, useMemo } from 'react';
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
import { GitCompare, Trophy, TrendingUp, ShieldCheck, ArrowRight } from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';
import { calculatePairedTTestPValue, calculateMean } from '@/lib/statistics';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function ComparisonPage() {
  const { models, resultsByModel, metrics, theme } = useDashboard();
  const [modelAId, setModelAId] = useState<string>('');
  const [modelBId, setModelBId] = useState<string>('');
  const [activeDeltaMetric, setActiveDeltaMetric] = useState<string>('ARI');

  const isDark = theme === 'dark';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  const modelA = models.find(m => m.id === modelAId) || models[0];
  const modelB = models.find(m => m.id === modelBId) || models[1] || models[0];

  const resA = modelA ? resultsByModel[modelA.id] : undefined;
  const resB = modelB ? resultsByModel[modelB.id] : undefined;

  // Compute comparison matrix across all metrics
  const comparisonData = useMemo(() => {
    return metrics.map(m => {
      const meanA = resA?.aggregatedMetrics?.[m.key]?.mean ?? 0;
      const meanB = resB?.aggregatedMetrics?.[m.key]?.mean ?? 0;
      const valuesA = resA?.aggregatedMetrics?.[m.key]?.values ?? [];
      const valuesB = resB?.aggregatedMetrics?.[m.key]?.values ?? [];

      const absDiff = meanB - meanA;
      const pctDiff = meanA !== 0 ? (absDiff / Math.abs(meanA)) * 100 : 0;
      const pValue = calculatePairedTTestPValue(valuesA, valuesB);
      
      const isHigherBetter = m.direction === 'higher_is_better';
      const isWinnerB = isHigherBetter ? absDiff > 0 : absDiff < 0;

      return {
        metric: m,
        meanA,
        meanB,
        absDiff,
        pctDiff,
        pValue,
        isSignificant: pValue < 0.05,
        isWinnerB,
      };
    });
  }, [metrics, resA, resB]);

  // Overall comparison summary stats
  const summaryStats = useMemo(() => {
    const validDeltas = comparisonData.filter(d => d.metric.key !== 'CHI');
    const avgPct = calculateMean(validDeltas.map(d => d.pctDiff));
    const winnerCountB = comparisonData.filter(d => d.isWinnerB).length;

    // Biggest winner metric
    const sortedByImpact = [...validDeltas].sort((a, b) => Math.abs(b.pctDiff) - Math.abs(a.pctDiff));
    const biggestWinner = sortedByImpact[0];

    // Paired p-value on primary ARI
    const primaryPValue = comparisonData.find(d => d.metric.key === 'ARI')?.pValue ?? 1.0;

    return {
      avgPct,
      winnerCountB,
      totalMetrics: comparisonData.length,
      biggestWinner,
      primaryPValue,
    };
  }, [comparisonData]);

  // Seed-by-seed difference for active metric
  const deltaBarData = useMemo(() => {
    const seedsA = resA?.seeds || {};
    const seedsB = resB?.seeds || {};
    const seedKeys = Array.from(new Set([...Object.keys(seedsA), ...Object.keys(seedsB)]));

    const labels = seedKeys.map(s => `Seed ${s}`);
    const deltas = seedKeys.map(s => {
      const valA = seedsA[Number(s)]?.finalMetrics?.[activeDeltaMetric] ?? 0;
      const valB = seedsB[Number(s)]?.finalMetrics?.[activeDeltaMetric] ?? 0;
      return Number((valB - valA).toFixed(4));
    });

    return {
      labels,
      datasets: [
        {
          label: `${modelB?.name || 'Model B'} - ${modelA?.name || 'Model A'} (${activeDeltaMetric})`,
          data: deltas,
          backgroundColor: deltas.map(d => (d >= 0 ? '#10b981' : '#ef4444')),
          borderRadius: 6,
        },
      ],
    };
  }, [resA, resB, modelA, modelB, activeDeltaMetric]);

  if (models.length < 2) {
    return (
      <div className="p-8 rounded-3xl bg-[var(--bg-secondary)] border border-dashed border-[var(--border-color)] text-center space-y-3">
        <GitCompare className="w-8 h-8 text-indigo-400 mx-auto" />
        <h3 className="font-heading font-bold text-base text-[var(--text-primary)]">
          Need at Least 2 Models to Compare Head-to-Head
        </h3>
        <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
          Currently there are {models.length} model(s) registered in the database. Run training for two or more models to view pairwise significance matrices and deltas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Model Selection Pair */}
      <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex-1 sm:w-60">
            <label htmlFor="model-a-select" className="text-xs font-semibold text-[var(--text-muted)] uppercase block mb-1">
              Model A (Baseline)
            </label>
            <select
              id="model-a-select"
              value={modelA?.id || ''}
              onChange={e => setModelAId(e.target.value)}
              className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm font-semibold rounded-xl px-3 py-2 focus:outline-none"
            >
              {models.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-5 text-indigo-400 font-bold text-xs flex items-center gap-1">
            <ArrowRight className="w-4 h-4" />
          </div>

          <div className="flex-1 sm:w-60">
            <label htmlFor="model-b-select" className="text-xs font-semibold text-[var(--text-muted)] uppercase block mb-1">
              Model B (Comparison Variant)
            </label>
            <select
              id="model-b-select"
              value={modelB?.id || ''}
              onChange={e => setModelBId(e.target.value)}
              className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm font-semibold rounded-xl px-3 py-2 focus:outline-none"
            >
              {models.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs text-[var(--text-muted)] font-medium block">Comparison Scope</span>
          <span className="text-sm font-bold text-indigo-400">
            {summaryStats.winnerCountB} of {summaryStats.totalMetrics} metrics won by {modelB?.name}
          </span>
        </div>
      </div>

      {/* Delta Performance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl p-5 bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-sm">
          <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
            Biggest Advantage Metric
          </span>
          <h3 className="text-xl font-heading font-bold text-[var(--text-primary)]">
            {summaryStats.biggestWinner?.metric.name}
          </h3>
          <span
            className={`text-xs font-semibold font-mono ${
              summaryStats.biggestWinner?.pctDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {summaryStats.biggestWinner?.pctDiff >= 0 ? '+' : ''}
            {summaryStats.biggestWinner?.pctDiff.toFixed(2)}% Relative Delta
          </span>
        </div>

        <div className="rounded-2xl p-5 bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-sm">
          <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
            Average Score Delta (A → B)
          </span>
          <h3 className="text-xl font-heading font-bold text-[var(--text-primary)] font-mono">
            {summaryStats.avgPct >= 0 ? '+' : ''}
            {summaryStats.avgPct.toFixed(2)}%
          </h3>
          <span className="text-xs text-[var(--text-muted)] block">
            Across all normalized clustering metrics
          </span>
        </div>

        <div className="rounded-2xl p-5 bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-sm">
          <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
            Statistical Significance (ARI)
          </span>
          <h3 className="text-xl font-heading font-bold text-emerald-600 dark:text-emerald-400 font-mono">
            {summaryStats.primaryPValue < 0.05 ? 'Significant (p < 0.05)' : 'Not Significant'}
          </h3>
          <span className="text-xs text-[var(--text-muted)] font-mono block">
            Paired t-test p = {summaryStats.primaryPValue.toFixed(4)}
          </span>
        </div>
      </div>

      {/* Comparison Matrix Table & Difference Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Table */}
        <div className="lg:col-span-7 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 shadow-sm flex flex-col">
          <div className="mb-4">
            <h3 className="text-base font-heading font-bold text-[var(--text-primary)]">
              Comparison Matrix ({modelA?.name} vs {modelB?.name})
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Difference in means and paired Student&apos;s t-test statistical significance
            </p>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] uppercase font-semibold">
                  <th className="pb-3">Metric</th>
                  <th className="pb-3">{modelA?.name}</th>
                  <th className="pb-3">{modelB?.name}</th>
                  <th className="pb-3">Abs Diff</th>
                  <th className="pb-3">% Diff</th>
                  <th className="pb-3">p-value</th>
                  <th className="pb-3">Sig?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {comparisonData.map(row => (
                  <tr key={row.metric.key} className="hover:bg-[var(--bg-tertiary)]/50 transition-colors">
                    <td className="py-2.5 font-semibold text-[var(--text-primary)]">
                      {row.metric.name}
                    </td>
                    <td className="py-2.5 font-mono text-[var(--text-secondary)]">
                      {row.meanA.toFixed(4)}
                    </td>
                    <td className="py-2.5 font-mono text-[var(--text-secondary)]">
                      {row.meanB.toFixed(4)}
                    </td>
                    <td
                      className={`py-2.5 font-mono font-semibold ${
                        row.isWinnerB ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {row.absDiff >= 0 ? '+' : ''}
                      {row.absDiff.toFixed(4)}
                    </td>
                    <td
                      className={`py-2.5 font-mono font-semibold ${
                        row.isWinnerB ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {row.pctDiff >= 0 ? '+' : ''}
                      {row.pctDiff.toFixed(2)}%
                    </td>
                    <td className="py-2.5 font-mono text-[var(--text-muted)]">
                      {row.pValue.toFixed(4)}
                    </td>
                    <td className="py-2.5">
                      {row.isSignificant ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                          p &lt; 0.05
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20">
                          n.s.
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Delta Bar Chart */}
        <div className="lg:col-span-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-heading font-bold text-[var(--text-primary)]">
                Seed Difference ({modelB?.name} - {modelA?.name})
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Pairwise delta per seed run for {activeDeltaMetric}
              </p>
            </div>
            <select
              value={activeDeltaMetric}
              onChange={e => setActiveDeltaMetric(e.target.value)}
              className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none"
            >
              {metrics.map(m => (
                <option key={m.key} value={m.key}>
                  {m.shortName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-h-[300px]">
            <Bar
              data={deltaBarData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10 } } },
                  y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10 } } },
                },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
