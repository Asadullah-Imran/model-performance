'use client';

import React, { useState } from 'react';
import { Trophy, Medal, ArrowUpRight, ArrowDownRight, Award } from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';

export function LeaderboardTable() {
  const { models, resultsByModel, metrics } = useDashboard();
  const [rankMetric, setRankMetric] = useState<string>('all');

  // Compute model rankings
  const rankedModels = React.useMemo(() => {
    return models
      .map(model => {
        const res = resultsByModel[model.id];
        
        // Calculate individual metric ranks
        let totalRankScore = 0;
        const metricMeans: Record<string, number> = {};

        metrics.forEach(m => {
          const mean = res?.aggregatedMetrics?.[m.key]?.mean ?? 0;
          metricMeans[m.key] = mean;
        });

        return {
          model,
          metricMeans,
          rawResult: res,
        };
      })
      .map((item, _, arr) => {
        // Calculate ranks across each metric
        const metricRanks: Record<string, number> = {};
        metrics.forEach(m => {
          const sorted = [...arr].sort((a, b) => {
            const valA = a.metricMeans[m.key] ?? 0;
            const valB = b.metricMeans[m.key] ?? 0;
            return m.direction === 'higher_is_better' ? valB - valA : valA - valB;
          });
          const r = sorted.findIndex(s => s.model.id === item.model.id) + 1;
          metricRanks[m.key] = r;
        });

        // Compute average rank across core clustering metrics (ARI, Sil, NMI, AMI, Homo, V-meas)
        const coreMetrics = ['ARI', 'Silhouette', 'NMI', 'AMI', 'Homogeneity', 'V-measure'];
        const avgRank = coreMetrics.reduce((sum, k) => sum + (metricRanks[k] || 1), 0) / coreMetrics.length;

        return {
          ...item,
          metricRanks,
          avgRank: Number(avgRank.toFixed(2)),
          primaryScore: rankMetric === 'all' ? avgRank : item.metricMeans[rankMetric] ?? 0,
        };
      })
      .sort((a, b) => {
        if (rankMetric === 'all') {
          return a.avgRank - b.avgRank; // Lower average rank is better (e.g. #1.2 vs #3.4)
        }
        const mDef = metrics.find(m => m.key === rankMetric);
        if (mDef?.direction === 'lower_is_better') {
          return (a.metricMeans[rankMetric] ?? 0) - (b.metricMeans[rankMetric] ?? 0);
        }
        return (b.metricMeans[rankMetric] ?? 0) - (a.metricMeans[rankMetric] ?? 0);
      });
  }, [models, resultsByModel, metrics, rankMetric]);

  return (
    <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 shadow-sm flex flex-col h-full">
      {/* Header with Metric Rank Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-base font-heading font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            Overall Performance Rank
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            {rankMetric === 'all'
              ? 'Ranked by harmonic average rank across all core evaluation metrics'
              : `Ranked strictly by ${rankMetric}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="rank-metric-select" className="text-xs text-[var(--text-muted)] font-medium">Rank by:</label>
          <select
            id="rank-metric-select"
            value={rankMetric}
            onChange={e => setRankMetric(e.target.value)}
            className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
          >
            <option value="all">Average Metric Rank</option>
            {metrics.map(m => (
              <option key={m.key} value={m.key}>
                {m.name} ({m.shortName})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Leaderboard List */}
      <div className="space-y-2.5 flex-1">
        {rankedModels.filter(m => m.rawResult && Object.keys(m.rawResult.seeds || {}).length > 0).length === 0 ? (
          <div className="p-8 rounded-xl bg-[var(--bg-tertiary)]/30 border border-dashed border-[var(--border-color)] text-center text-xs text-[var(--text-muted)]">
            No experiment runs uploaded yet. Run training or click <strong className="text-indigo-400">Import to DB</strong> above.
          </div>
        ) : (
          rankedModels.map((item, index) => {
          const rank = index + 1;
          const isTop3 = rank <= 3;
          const medalColors = ['text-amber-400', 'text-slate-300', 'text-amber-600'];

          return (
            <div
              key={item.model.id}
              className={`flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 ${
                rank === 1
                  ? 'bg-amber-500/5 border-amber-500/30 shadow-sm'
                  : 'bg-[var(--bg-tertiary)]/40 border-[var(--border-color)] hover:border-indigo-500/30'
              }`}
            >
              {/* Rank & Model Identity */}
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0">
                  {isTop3 ? (
                    <Award className={`w-5 h-5 ${medalColors[rank - 1]}`} />
                  ) : (
                    <span className="text-[var(--text-muted)]">#{rank}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-heading font-bold text-sm text-[var(--text-primary)] truncate">
                      {item.model.name}
                    </h4>
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: item.model.colorTheme.baseColor }}
                    />
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)] truncate block">
                    {item.model.architecture}
                  </span>
                </div>
              </div>

              {/* Metrics Snapshot */}
              <div className="flex items-center gap-6 text-right flex-shrink-0">
                <div className="hidden sm:block">
                  <span className="text-[10px] text-[var(--text-muted)] font-medium block">ARI / Sil</span>
                  <span className="text-xs font-mono font-bold text-[var(--text-primary)]">
                    {item.metricMeans['ARI']?.toFixed(3)} / {item.metricMeans['Silhouette']?.toFixed(3)}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-[var(--text-muted)] font-medium block">
                    {rankMetric === 'all' ? 'Avg Rank' : rankMetric}
                  </span>
                  <span className="text-sm font-mono font-bold text-indigo-400">
                    {rankMetric === 'all'
                      ? `#${item.avgRank.toFixed(1)}`
                      : item.metricMeans[rankMetric]?.toFixed(4)}
                  </span>
                </div>
              </div>
            </div>
          );
        }))}
      </div>
    </div>
  );
}
