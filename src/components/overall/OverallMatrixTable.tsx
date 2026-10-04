'use client';

import React, { useMemo } from 'react';
import { Table, Trophy, Download, ArrowUpDown } from 'lucide-react';
import { DatasetInfo, ModelMetadata, ModelDatasetResults } from '@/types';
import { METRIC_REGISTRY } from '@/lib/registry';
import { SeedMode } from './OverallFilterBar';

interface OverallMatrixTableProps {
  datasets: DatasetInfo[];
  models: ModelMetadata[];
  selectedModelIds: string[];
  datasetResults: Record<string, { resultsByModel: Record<string, ModelDatasetResults> }>;
  selectedMetric: string;
  seedMode: SeedMode;
}

export function OverallMatrixTable({
  datasets,
  models,
  selectedModelIds,
  datasetResults,
  selectedMetric,
  seedMode,
}: OverallMatrixTableProps) {
  const metricDef = METRIC_REGISTRY.find(m => m.key === selectedMetric) || METRIC_REGISTRY[0];
  const higherIsBetter = metricDef.direction === 'higher_is_better';

  const activeModels = useMemo(() => {
    const list = models.filter(m => selectedModelIds.includes(m.id));
    return list.length > 0 ? list : models;
  }, [models, selectedModelIds]);

  // Build matrix data
  const matrixData = useMemo(() => {
    // For each dataset, compute max/best value
    const bestByDataset: Record<string, number> = {};
    datasets.forEach(ds => {
      const vals: number[] = [];
      activeModels.forEach(m => {
        const res = datasetResults[ds.id]?.resultsByModel?.[m.id];
        if (res) {
          if (seedMode === 'mean') {
            const v = res.aggregatedMetrics?.[selectedMetric]?.mean;
            if (v !== undefined && !isNaN(v)) vals.push(v);
          } else if (seedMode === 'seed_42' || seedMode === 'seed_2024') {
            const targetSeed = seedMode === 'seed_42' ? 42 : 2024;
            const v = res.seeds?.[targetSeed]?.finalMetrics?.[selectedMetric];
            if (v !== undefined && !isNaN(v)) vals.push(v);
          } else if (seedMode === 'best') {
            const allV = Object.values(res.seeds || {})
              .map(s => s.finalMetrics?.[selectedMetric])
              .filter((x): x is number => typeof x === 'number' && !isNaN(x));
            if (allV.length > 0) vals.push(higherIsBetter ? Math.max(...allV) : Math.min(...allV));
          }
        }
      });
      if (vals.length > 0) {
        bestByDataset[ds.id] = higherIsBetter ? Math.max(...vals) : Math.min(...vals);
      }
    });

    const rows = activeModels.map(model => {
      const scores: Record<string, number | null> = {};
      let total = 0;
      let count = 0;

      datasets.forEach(ds => {
        const res = datasetResults[ds.id]?.resultsByModel?.[model.id];
        if (!res) {
          scores[ds.id] = null;
          return;
        }

        let val: number | null = null;
        if (seedMode === 'mean') {
          const v = res.aggregatedMetrics?.[selectedMetric]?.mean;
          if (v !== undefined && !isNaN(v)) val = v;
        } else if (seedMode === 'seed_42' || seedMode === 'seed_2024') {
          const targetSeed = seedMode === 'seed_42' ? 42 : 2024;
          const v = res.seeds?.[targetSeed]?.finalMetrics?.[selectedMetric];
          if (v !== undefined && !isNaN(v)) val = v;
        } else if (seedMode === 'best') {
          const allV = Object.values(res.seeds || {})
            .map(s => s.finalMetrics?.[selectedMetric])
            .filter((x): x is number => typeof x === 'number' && !isNaN(x));
          if (allV.length > 0) val = higherIsBetter ? Math.max(...allV) : Math.min(...allV);
        }

        scores[ds.id] = val;
        if (val !== null) {
          total += val;
          count += 1;
        }
      });

      const avgScore = count > 0 ? total / count : 0;

      return {
        model,
        scores,
        avgScore,
        count,
      };
    });

    rows.sort((a, b) => higherIsBetter ? b.avgScore - a.avgScore : a.avgScore - b.avgScore);

    return {
      rows,
      bestByDataset,
    };
  }, [activeModels, datasets, datasetResults, selectedMetric, seedMode, higherIsBetter]);

  // CSV export handler
  const handleExportCSV = () => {
    const header = ['Model Name', 'Architecture', ...datasets.map(d => d.name), `Average ${selectedMetric}`];
    const csvRows = [header.join(',')];

    matrixData.rows.forEach(r => {
      const row = [
        `"${r.model.name}"`,
        `"${r.model.architecture || ''}"`,
        ...datasets.map(d => r.scores[d.id] !== null ? r.scores[d.id]!.toFixed(4) : 'N/A'),
        r.avgScore.toFixed(4),
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `benchmark_matrix_${selectedMetric.toLowerCase()}_${seedMode}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-color)]/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
              <Table className="w-4 h-4" />
            </div>
            <h3 className="text-base font-heading font-bold text-[var(--text-primary)]">
              Cross-Dataset Performance Matrix ({selectedMetric})
            </h3>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Full score breakdown with automatic highlight of the best performing model per dataset
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] hover:border-indigo-500/40 text-xs font-semibold text-[var(--text-primary)] transition-colors shadow-sm"
        >
          <Download className="w-3.5 h-3.5 text-indigo-500" />
          <span>Export CSV</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/50">
              <th className="py-3 px-4 font-bold text-[var(--text-primary)] rounded-l-xl">Rank & Model</th>
              {datasets.map(ds => (
                <th key={ds.id} className="py-3 px-3 font-semibold text-[var(--text-secondary)] text-right">
                  <div className="truncate max-w-[130px] font-medium" title={ds.name}>
                    {ds.name.replace('10x Human Lymph Node ', 'Lymph Node ').replace('Mouse Brain ', 'Mouse ')}
                  </div>
                </th>
              ))}
              <th className="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-400 text-right rounded-r-xl">
                Global Avg
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]/50">
            {matrixData.rows.map((row, rankIdx) => {
              const color = row.model.colorTheme?.baseColor || '#6366f1';
              const isRank1 = rankIdx === 0;

              return (
                <tr key={row.model.id} className="hover:bg-[var(--bg-tertiary)]/40 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono font-bold text-[10px] ${
                        isRank1
                          ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/30'
                          : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border border-[var(--border-color)]'
                      }`}>
                        {rankIdx + 1}
                      </span>
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: color }}
                      />
                      <div>
                        <span className="font-bold text-[var(--text-primary)]">{row.model.name}</span>
                        {row.model.architecture && (
                          <span className="block text-[10px] text-[var(--text-muted)] truncate max-w-[160px]">
                            {row.model.architecture}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {datasets.map(ds => {
                    const score = row.scores[ds.id];
                    const isBest = score !== null && matrixData.bestByDataset[ds.id] !== undefined && Math.abs(score - matrixData.bestByDataset[ds.id]) < 0.0001;

                    return (
                      <td key={ds.id} className="py-3 px-3 text-right font-mono">
                        {score !== null ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ${
                            isBest
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20'
                              : 'text-[var(--text-secondary)]'
                          }`}>
                            {isBest && <Trophy className="w-3 h-3 text-emerald-500" />}
                            {score.toFixed(4)}
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)] opacity-40">-</span>
                        )}
                      </td>
                    );
                  })}

                  <td className="py-3 px-4 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                    {row.avgScore > 0 ? row.avgScore.toFixed(4) : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
