'use client';

import React, { useMemo } from 'react';
import { Sliders, Equal, RotateCcw, Trophy, Grid, Sparkles } from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';
import { calculateCorrelationMatrix } from '@/lib/statistics';

export default function AblationPage() {
  const {
    models,
    resultsByModel,
    metrics,
    rawRecords,
    metricWeights,
    updateMetricWeight,
    resetMetricWeights,
    equalizeMetricWeights,
  } = useDashboard();

  // Normalize weights so they sum to 100%
  const totalWeight = Object.values(metricWeights).reduce((sum, w) => sum + w, 0) || 1;

  // Compute customized multi-criteria weighted score for each model
  const customRankings = useMemo(() => {
    return models
      .map(model => {
        const res = resultsByModel[model.id];
        let weightedScore = 0;

        metrics.forEach(m => {
          const weight = metricWeights[m.key] || 0;
          if (weight === 0) return;

          const meanVal = res?.aggregatedMetrics?.[m.key]?.mean ?? 0;
          
          // Normalized value between 0 and 1
          let normalized = meanVal;
          if (m.key === 'CHI') {
            normalized = Math.min(1.0, meanVal / 2000);
          } else if (m.key === 'DBI') {
            // Lower is better: invert
            normalized = Math.max(0, 1.0 - meanVal / 2.0);
          } else {
            normalized = Math.max(0, Math.min(1, meanVal));
          }

          weightedScore += (normalized * (weight / totalWeight)) * 100;
        });

        return {
          model,
          customScore: Number(weightedScore.toFixed(2)),
          res,
        };
      })
      .sort((a, b) => b.customScore - a.customScore);
  }, [models, resultsByModel, metrics, metricWeights, totalWeight]);

  // Compute Metric Correlation Heatmap Matrix
  const correlationMatrix = useMemo(() => {
    const coreMetricKeys = metrics.map(m => m.key);
    const records = rawRecords.map(r => r.metrics);
    return calculateCorrelationMatrix(coreMetricKeys, records);
  }, [metrics, rawRecords]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Weight Preference Sliders */}
        <div className="lg:col-span-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-heading font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                Metric Preference Sliders
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Adjust the relative evaluation weight of each metric
              </p>
            </div>
            <div className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Total: {totalWeight}%
            </div>
          </div>

          <div className="space-y-4 flex-1">
            {metrics.map(m => {
              const currentWeight = metricWeights[m.key] ?? 0;
              const effectivePct = ((currentWeight / totalWeight) * 100).toFixed(1);

              return (
                <div key={m.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[var(--text-primary)]">
                      {m.name} ({m.shortName})
                    </span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-[var(--text-muted)] text-[11px]">{effectivePct}%</span>
                      <span className="text-indigo-400 font-bold w-7 text-right">{currentWeight}</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={currentWeight}
                    onChange={e => updateMetricWeight(m.key, Number(e.target.value))}
                    className="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-6 border-t border-[var(--border-color)] mt-4">
            <button
              onClick={equalizeMetricWeights}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 text-[var(--text-primary)] border border-[var(--border-color)] transition-colors"
            >
              <Equal className="w-3.5 h-3.5" />
              Equalize
            </button>
            <button
              onClick={resetMetricWeights}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>
        </div>

        {/* Right: Dynamic Custom Score Leaderboard */}
        <div className="lg:col-span-7 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 shadow-sm flex flex-col">
          <div className="mb-4">
            <h2 className="text-base font-heading font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              Customized Performance Score Leaderboard
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Calculated in real-time as the weighted sum of normalized performance scores
            </p>
          </div>

          <div className="space-y-3 flex-1">
            {customRankings.map((item, idx) => {
              const rank = idx + 1;
              const isWinner = rank === 1;

              return (
                <div
                  key={item.model.id}
                  className={`p-4 rounded-xl border transition-all duration-200 flex items-center justify-between ${
                    isWinner
                      ? 'bg-indigo-600/10 border-indigo-500/40 shadow-sm'
                      : 'bg-[var(--bg-tertiary)]/40 border-[var(--border-color)]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                        isWinner ? 'bg-indigo-600 text-white shadow-md' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
                      }`}
                    >
                      #{rank}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-heading font-bold text-sm text-[var(--text-primary)]">
                          {item.model.name}
                        </h4>
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: item.model.colorTheme.baseColor }}
                        />
                      </div>
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {item.model.architecture}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block">
                      Custom Score
                    </span>
                    <span className="text-lg font-mono font-bold text-indigo-400">
                      {item.customScore} / 100
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Metrics Correlation Heatmap */}
      <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-heading font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Grid className="w-4 h-4 text-emerald-400" />
            Metrics Correlation Matrix (Pearson Correlation)
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Co-variance and correlation between evaluation metrics across all seed runs
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center text-xs">
            <thead>
              <tr>
                <th className="p-2 text-left text-[var(--text-muted)] font-semibold">Metric</th>
                {metrics.map(m => (
                  <th key={m.key} className="p-2 text-[var(--text-muted)] font-semibold">
                    {m.shortName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map(m1 => (
                <tr key={m1.key} className="border-t border-[var(--border-color)]">
                  <td className="p-2 text-left font-semibold text-[var(--text-primary)]">
                    {m1.name} ({m1.shortName})
                  </td>
                  {metrics.map(m2 => {
                    const r = correlationMatrix[m1.key]?.[m2.key] ?? 0;
                    const isPositive = r >= 0;
                    const absR = Math.abs(r);

                    return (
                      <td key={m2.key} className="p-2 font-mono">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                            m1.key === m2.key
                              ? 'bg-indigo-600 text-white font-bold'
                              : isPositive
                              ? `bg-emerald-500/${Math.round(absR * 40 + 10)} text-emerald-400`
                              : `bg-rose-500/${Math.round(absR * 40 + 10)} text-rose-400`
                          }`}
                        >
                          {r >= 0 ? '+' : ''}
                          {r.toFixed(2)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
