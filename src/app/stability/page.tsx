'use client';

import React, { useState, useMemo } from 'react';
import { ShieldCheck, Download, Filter } from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';

export default function StabilityPage() {
  const { models, resultsByModel, metrics } = useDashboard();
  const [selectedModel, setSelectedModel] = useState<string>('all');

  const stabilityRows = useMemo(() => {
    const rows: Array<{
      modelName: string;
      metricName: string;
      metricKey: string;
      mean: number;
      median: number;
      stdDev: number;
      sem: number;
      cv: number;
      min: number;
      max: number;
      range: number;
    }> = [];

    const activeModels = selectedModel === 'all'
      ? models
      : models.filter(m => m.id === selectedModel);

    activeModels.forEach(model => {
      const agg = resultsByModel[model.id]?.aggregatedMetrics || {};
      metrics.forEach(m => {
        const stats = agg[m.key];
        if (stats) {
          rows.push({
            modelName: model.name,
            metricName: m.name,
            metricKey: m.key,
            mean: stats.mean,
            median: stats.median,
            stdDev: stats.stdDev,
            sem: stats.sem,
            cv: stats.cv,
            min: stats.min,
            max: stats.max,
            range: stats.range,
          });
        }
      });
    });

    return rows;
  }, [models, resultsByModel, metrics, selectedModel]);

  const exportCSV = () => {
    const headers = ['Model', 'Metric', 'Mean', 'Median', 'Std Dev', 'SEM', 'CV (%)', 'Min', 'Max', 'Range'];
    const csvContent = [
      headers.join(','),
      ...stabilityRows.map(r =>
        [
          `"${r.modelName}"`,
          `"${r.metricName}"`,
          r.mean,
          r.median,
          r.stdDev,
          r.sem,
          r.cv,
          r.min,
          r.max,
          r.range,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `statistical_stability_${selectedModel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 shadow-sm flex flex-col">
        {/* Header and Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-base font-heading font-bold text-[var(--text-primary)] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              Summary Statistics Table
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Performance stability analysis across seeds (Mean, Median, Standard Deviation σ, CV%, Min, Max, Range)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <select
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
                className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs font-semibold rounded-xl px-3 py-1.5 focus:outline-none"
              >
                <option value="all">All Models</option>
                {models.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 text-xs font-semibold border border-indigo-500/30 transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Export Stats CSV
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] uppercase font-semibold">
                <th className="pb-3">Model</th>
                <th className="pb-3">Metric</th>
                <th className="pb-3">Mean</th>
                <th className="pb-3">Median</th>
                <th className="pb-3">Std Dev (σ)</th>
                <th className="pb-3">CV (%)</th>
                <th className="pb-3">Min</th>
                <th className="pb-3">Max</th>
                <th className="pb-3">Range</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {stabilityRows.map((row, idx) => (
                <tr key={`${row.modelName}-${row.metricKey}-${idx}`} className="hover:bg-[var(--bg-tertiary)]/30 transition-colors">
                  <td className="py-2.5 font-bold text-[var(--text-primary)]">
                    {row.modelName}
                  </td>
                  <td className="py-2.5 text-[var(--text-secondary)] font-medium">
                    {row.metricName}
                  </td>
                  <td className="py-2.5 font-mono font-bold text-indigo-400">
                    {row.mean.toFixed(4)}
                  </td>
                  <td className="py-2.5 font-mono text-[var(--text-secondary)]">
                    {row.median.toFixed(4)}
                  </td>
                  <td className="py-2.5 font-mono text-[var(--text-muted)]">
                    ±{row.stdDev.toFixed(4)}
                  </td>
                  <td className="py-2.5 font-mono">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        row.cv < 5
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : row.cv < 10
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-rose-500/10 text-rose-400'
                      }`}
                    >
                      {row.cv.toFixed(2)}%
                    </span>
                  </td>
                  <td className="py-2.5 font-mono text-[var(--text-secondary)]">
                    {row.min.toFixed(4)}
                  </td>
                  <td className="py-2.5 font-mono text-[var(--text-secondary)]">
                    {row.max.toFixed(4)}
                  </td>
                  <td className="py-2.5 font-mono text-[var(--text-muted)]">
                    {row.range.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
