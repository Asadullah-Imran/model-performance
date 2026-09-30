'use client';

import React from 'react';
import { useDashboard } from '@/context/DashboardContext';
import { Filter, Check, RotateCcw, CheckSquare, BarChart2 } from 'lucide-react';

export function ModelFilterBar() {
  const {
    metrics,
    selectedMetric,
    setSelectedMetric,
    models,
    selectedModelIds,
    toggleModelFilter,
    selectAllModels,
    deselectAllModels,
    filteredModels,
  } = useDashboard();

  const allSelected = selectedModelIds.length === models.length;

  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-sm">
      {/* Top Row: Metric Filter Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border-color)]">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mr-2">
            <BarChart2 className="w-3.5 h-3.5 text-indigo-500" />
            <span>Metric:</span>
          </div>
          {metrics.map(m => {
            const isSelected = selectedMetric === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setSelectedMetric(m.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 scale-[1.03]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] border border-transparent'
                }`}
              >
                {m.name} ({m.shortName})
              </button>
            );
          })}
        </div>

        {/* Selected Counter Badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            {filteredModels.length} of {models.length} Models Selected
          </span>
        </div>
      </div>

      {/* Bottom Row: Multi-Model Filter Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mr-2">
            <Filter className="w-3.5 h-3.5 text-indigo-500" />
            <span>Filter Models:</span>
          </div>

          {models.map(model => {
            const isSelected = selectedModelIds.includes(model.id);
            const baseColor = model.colorTheme?.baseColor || '#6366f1';

            return (
              <button
                key={model.id}
                onClick={() => toggleModelFilter(model.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 border cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-primary)] shadow-sm'
                    : 'opacity-40 bg-transparent border-dashed border-[var(--border-color)] text-[var(--text-muted)] hover:opacity-75'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full transition-transform"
                  style={{
                    backgroundColor: baseColor,
                    transform: isSelected ? 'scale(1.1)' : 'scale(0.8)',
                    boxShadow: isSelected ? `0 0 8px ${baseColor}66` : 'none',
                  }}
                />
                <span className="font-semibold">{model.name}</span>
                {isSelected ? (
                  <Check className="w-3 h-3 text-emerald-500 stroke-[2.5]" />
                ) : (
                  <span className="w-3 h-3 block" />
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Actions (Select All / Reset) */}
        <div className="flex items-center gap-2">
          <button
            onClick={selectAllModels}
            disabled={allSelected}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
              allSelected
                ? 'opacity-40 cursor-not-allowed border-[var(--border-color)] text-[var(--text-muted)]'
                : 'bg-[var(--bg-tertiary)] hover:bg-indigo-50 dark:hover:bg-indigo-500/10 border-[var(--border-color)] hover:border-indigo-500/40 text-[var(--text-secondary)] hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer'
            }`}
          >
            <CheckSquare className="w-3 h-3" />
            <span>Select All</span>
          </button>

          <button
            onClick={deselectAllModels}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--bg-tertiary)] hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-[var(--border-color)] hover:border-rose-500/40 text-[var(--text-secondary)] hover:text-rose-600 dark:hover:text-rose-400 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Single Model</span>
          </button>
        </div>
      </div>
    </div>
  );
}
