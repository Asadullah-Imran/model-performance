'use client';

import React from 'react';
import {
  Filter,
  Check,
  CheckSquare,
  Square,
  Layers,
  ArrowUpDown,
  LayoutGrid,
  BarChart2,
  Table as TableIcon,
  Sparkles,
  Info,
} from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';
import { METRIC_REGISTRY } from '@/lib/registry';

export type LayoutMode = 'grid' | 'macro' | 'table';
export type SeedMode = 'mean' | 'seed_42' | 'seed_2024' | 'best';

interface OverallFilterBarProps {
  selectedMetric: string;
  onSelectMetric: (metricKey: string) => void;
  selectedModelIds: string[];
  onToggleModel: (modelId: string) => void;
  onSelectAllModels: () => void;
  onDeselectAllModels: () => void;
  seedMode: SeedMode;
  onSelectSeedMode: (mode: SeedMode) => void;
  layoutMode: LayoutMode;
  onSelectLayoutMode: (mode: LayoutMode) => void;
  sortByScore: boolean;
  onToggleSortByScore: () => void;
  availableSeeds?: number[];
}

export function OverallFilterBar({
  selectedMetric,
  onSelectMetric,
  selectedModelIds,
  onToggleModel,
  onSelectAllModels,
  onDeselectAllModels,
  seedMode,
  onSelectSeedMode,
  layoutMode,
  onSelectLayoutMode,
  sortByScore,
  onToggleSortByScore,
  availableSeeds = [42, 2024],
}: OverallFilterBarProps) {
  const { models } = useDashboard();
  const currentMetricDef = METRIC_REGISTRY.find(m => m.key === selectedMetric) || METRIC_REGISTRY[0];
  const isHigherBetter = currentMetricDef.direction === 'higher_is_better';

  const allSelected = models.length > 0 && selectedModelIds.length === models.length;

  return (
    <div className="space-y-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-5 shadow-sm">
      {/* Top Row: Metric Selector Pills & View Modes */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[var(--border-color)]/70 pb-4">
        {/* Metric Selector */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Evaluation Metric:
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
              isHigherBetter
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
            }`}>
              {isHigherBetter ? '↑ Higher is better' : '↓ Lower is better'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {METRIC_REGISTRY.map(m => {
              const isSelected = m.key === selectedMetric;
              return (
                <button
                  key={m.key}
                  onClick={() => onSelectMetric(m.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 ring-2 ring-indigo-500/30'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]/80 border border-[var(--border-color)]'
                  }`}
                  title={m.description || m.name}
                >
                  <span>{m.shortName || m.key}</span>
                  {isSelected && <span className="text-[10px] opacity-75">({m.key})</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* View Mode & Seed Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Seed Mode */}
          <div className="flex items-center gap-1.5 bg-[var(--bg-tertiary)] p-1 rounded-xl border border-[var(--border-color)]">
            <button
              onClick={() => onSelectSeedMode('mean')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                seedMode === 'mean'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Mean ± SEM
            </button>
            {availableSeeds.map(seed => {
              const modeKey: SeedMode = seed === 42 ? 'seed_42' : 'seed_2024';
              return (
                <button
                  key={seed}
                  onClick={() => onSelectSeedMode(modeKey)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    seedMode === modeKey
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Seed {seed}
                </button>
              );
            })}
            <button
              onClick={() => onSelectSeedMode('best')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                seedMode === 'best'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Best Seed
            </button>
          </div>

          {/* Sort Order Toggle */}
          <button
            onClick={onToggleSortByScore}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              sortByScore
                ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border-color)] hover:text-[var(--text-primary)]'
            }`}
            title="Toggle between sorting models by performance rank vs fixed sequence"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>{sortByScore ? 'Rank Sorted' : 'Model Order'}</span>
          </button>

          {/* Layout Mode Tabs */}
          <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] p-1 rounded-xl border border-[var(--border-color)]">
            <button
              onClick={() => onSelectLayoutMode('grid')}
              className={`p-1.5 rounded-lg text-xs transition-all ${
                layoutMode === 'grid'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              title="Dataset Cards Grid"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => onSelectLayoutMode('macro')}
              className={`p-1.5 rounded-lg text-xs transition-all ${
                layoutMode === 'macro'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              title="All-in-One Grouped Macro Chart"
            >
              <BarChart2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onSelectLayoutMode('table')}
              className={`p-1.5 rounded-lg text-xs transition-all ${
                layoutMode === 'table'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              title="Performance Score Matrix Table"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Row: Model Selection Checklist */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-indigo-500" />
            Filter Models:
          </span>

          {/* Individual Model Toggle Badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            {models.map(model => {
              const isChecked = selectedModelIds.includes(model.id);
              const color = model.colorTheme?.baseColor || '#6366f1';

              return (
                <button
                  key={model.id}
                  onClick={() => onToggleModel(model.id)}
                  className={`inline-flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-semibold transition-all duration-200 border ${
                    isChecked
                      ? 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-primary)] shadow-sm hover:border-indigo-500/50'
                      : 'bg-[var(--bg-tertiary)]/50 border-transparent text-[var(--text-muted)] opacity-50 hover:opacity-80'
                  }`}
                  style={{
                    borderLeftColor: isChecked ? color : 'transparent',
                    borderLeftWidth: isChecked ? '3.5px' : '1px',
                  }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full transition-all shrink-0"
                    style={{
                      backgroundColor: isChecked ? color : '#94a3b8',
                      boxShadow: isChecked ? `0 0 8px ${color}66` : 'none',
                    }}
                  />
                  <span>{model.name}</span>
                  {isChecked && (
                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 flex items-center justify-center text-[9px] font-bold">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Select All / Deselect All */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={allSelected ? onDeselectAllModels : onSelectAllModels}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            {allSelected ? <Square className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5" />}
            {allSelected ? 'Reset (Single Model)' : 'Select All Models'}
          </button>
          <span className="text-[var(--text-muted)]">•</span>
          <span className="text-[11px] text-[var(--text-muted)]">
            Showing <strong className="text-[var(--text-primary)]">{selectedModelIds.length}</strong> of {models.length} models
          </span>
        </div>
      </div>
    </div>
  );
}
