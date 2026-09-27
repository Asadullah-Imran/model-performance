'use client';

import React from 'react';
import { Activity, Sparkles, Zap } from 'lucide-react';
import { ModelMetadata, ModelDatasetResults } from '@/types';

interface Props {
  model: ModelMetadata;
  results: ModelDatasetResults;
  rank?: number;
}

export function ModelSummaryCard({ model, results, rank }: Props) {
  const hasRuns = results && results.aggregatedMetrics && Object.keys(results.aggregatedMetrics).length > 0;

  const ariStats = results?.aggregatedMetrics?.['ARI'];
  const silStats = results?.aggregatedMetrics?.['Silhouette'];
  const nmiStats = results?.aggregatedMetrics?.['NMI'];

  return (
    <div className="relative group overflow-hidden rounded-2xl p-5 bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-indigo-500/40 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1">
      {/* Background Accent Glow */}
      <div
        className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10 blur-2xl pointer-events-none transition-opacity duration-300 group-hover:opacity-20"
        style={{ backgroundColor: model.colorTheme.baseColor }}
      />

      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-3 h-3 rounded-full shadow-sm"
            style={{ backgroundColor: model.colorTheme.baseColor }}
          />
          <div>
            <h3 className="font-heading font-bold text-base text-[var(--text-primary)] leading-none">
              {model.name}
            </h3>
            <span className="text-[11px] text-[var(--text-muted)] font-medium">
              {model.architecture}
            </span>
          </div>
        </div>
        {rank !== undefined && hasRuns && (
          <span className="px-2 py-0.5 text-[11px] font-bold rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-color)]">
            #{rank} Rank
          </span>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-2.5 py-3 border-y border-[var(--border-color)] bg-[var(--bg-tertiary)]/30 rounded-xl px-3 my-3">
        <div>
          <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
            Mean ARI
          </span>
          <span className="text-base font-bold text-[var(--text-primary)] font-mono">
            {ariStats ? ariStats.mean.toFixed(4) : '-'}
          </span>
          <span className="text-[10px] text-[var(--text-muted)] block font-mono">
            {ariStats ? `±${ariStats.stdDev.toFixed(3)}` : 'No data'}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
            Mean Sil
          </span>
          <span className="text-base font-bold text-[var(--text-primary)] font-mono">
            {silStats ? silStats.mean.toFixed(4) : '-'}
          </span>
          <span className="text-[10px] text-[var(--text-muted)] block font-mono">
            {silStats ? `±${silStats.stdDev.toFixed(3)}` : 'No data'}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
            Mean NMI
          </span>
          <span className="text-base font-bold text-[var(--text-primary)] font-mono">
            {nmiStats ? nmiStats.mean.toFixed(4) : '-'}
          </span>
          <span className="text-[10px] text-[var(--text-muted)] block font-mono">
            {nmiStats ? `±${nmiStats.stdDev.toFixed(3)}` : 'No data'}
          </span>
        </div>
      </div>

      {/* Card Footer: Stability & Seed Variance */}
      <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] mt-1">
        <span className="flex items-center gap-1.5 font-medium">
          <Activity className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          Stability (CV%):
        </span>
        <span className="font-mono font-semibold text-[var(--text-secondary)]">
          {ariStats ? `${ariStats.cv.toFixed(2)}%` : '-'}
        </span>
      </div>
    </div>
  );
}
