'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Table,
  Download,
  Search,
  ChevronsUpDown,
  Filter,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Cpu,
  Database,
  Hash,
  CheckSquare,
  Square,
} from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';
import { formatDuration } from '@/lib/statistics';

type SortColumn = 'modelName' | 'datasetName' | 'seed' | 'ARI' | 'NMI' | 'AMI' | 'Homogeneity' | 'V-measure' | 'Silhouette' | 'durationSeconds';

export default function InspectorPage() {
  const { rawRecords, models, datasets } = useDashboard();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);

  // Derive unique filter options dynamically from rawRecords + context registries
  const availableModels = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color?: string; count: number }>();
    models.forEach(m => {
      map.set(m.id, {
        id: m.id,
        name: m.name,
        color: m.colorTheme?.baseColor,
        count: 0,
      });
    });
    rawRecords.forEach(r => {
      const existing = map.get(r.modelId);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(r.modelId, {
          id: r.modelId,
          name: r.modelName || r.modelId,
          count: 1,
        });
      }
    });
    return Array.from(map.values()).filter(m => m.count > 0 || models.some(mod => mod.id === m.id));
  }, [rawRecords, models]);

  const availableDatasets = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    datasets.forEach(d => {
      map.set(d.id, { id: d.id, name: d.name, count: 0 });
    });
    rawRecords.forEach(r => {
      const existing = map.get(r.datasetId);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(r.datasetId, {
          id: r.datasetId,
          name: r.datasetName || r.datasetId,
          count: 1,
        });
      }
    });
    return Array.from(map.values()).filter(d => d.count > 0);
  }, [rawRecords, datasets]);

  const availableSeeds = useMemo(() => {
    const counts = new Map<number, number>();
    rawRecords.forEach(r => {
      counts.set(r.seed, (counts.get(r.seed) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([seed, count]) => ({ seed, count }))
      .sort((a, b) => a.seed - b.seed);
  }, [rawRecords]);

  // Track excluded IDs/seeds so that newly loaded items are checked by default,
  // while allowing users to uncheck any combination (including unchecking all).
  const [excludedModels, setExcludedModels] = useState<Set<string>>(new Set());
  const [excludedDatasets, setExcludedDatasets] = useState<Set<string>>(new Set());
  const [excludedSeeds, setExcludedSeeds] = useState<Set<number>>(new Set());

  // Clean up any stale exclusions if available items change
  useEffect(() => {
    setExcludedModels(prev => {
      const validIds = new Set(availableModels.map(m => m.id));
      const next = new Set(Array.from(prev).filter(id => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [availableModels]);

  useEffect(() => {
    setExcludedDatasets(prev => {
      const validIds = new Set(availableDatasets.map(d => d.id));
      const next = new Set(Array.from(prev).filter(id => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [availableDatasets]);

  useEffect(() => {
    setExcludedSeeds(prev => {
      const validSeeds = new Set(availableSeeds.map(s => s.seed));
      const next = new Set(Array.from(prev).filter(s => validSeeds.has(s)));
      return next.size === prev.size ? prev : next;
    });
  }, [availableSeeds]);

  const [sortCol, setSortCol] = useState<SortColumn>('ARI');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const toggleModel = (id: string) => {
    setExcludedModels(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleDataset = (id: string) => {
    setExcludedDatasets(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSeed = (seed: number) => {
    setExcludedSeeds(prev => {
      const next = new Set(prev);
      if (next.has(seed)) next.delete(seed);
      else next.add(seed);
      return next;
    });
  };

  const selectAllModels = () => setExcludedModels(new Set());
  const deselectAllModels = () => setExcludedModels(new Set(availableModels.map(m => m.id)));

  const selectAllDatasets = () => setExcludedDatasets(new Set());
  const deselectAllDatasets = () => setExcludedDatasets(new Set(availableDatasets.map(d => d.id)));

  const selectAllSeeds = () => setExcludedSeeds(new Set());
  const deselectAllSeeds = () => setExcludedSeeds(new Set(availableSeeds.map(s => s.seed)));

  const resetAllFilters = () => {
    setExcludedModels(new Set());
    setExcludedDatasets(new Set());
    setExcludedSeeds(new Set());
    setSearchTerm('');
  };

  const selectedModelsCount = availableModels.length - excludedModels.size;
  const selectedDatasetsCount = availableDatasets.length - excludedDatasets.size;
  const selectedSeedsCount = availableSeeds.length - excludedSeeds.size;

  const activeFilterGroupsCount =
    (excludedModels.size > 0 ? 1 : 0) +
    (excludedDatasets.size > 0 ? 1 : 0) +
    (excludedSeeds.size > 0 ? 1 : 0);

  const hasAnyFilter =
    excludedModels.size > 0 ||
    excludedDatasets.size > 0 ||
    excludedSeeds.size > 0 ||
    searchTerm.trim().length > 0;

  const filteredRecords = useMemo(() => {
    return rawRecords
      .filter(r => {
        if (excludedModels.has(r.modelId)) return false;
        if (excludedDatasets.has(r.datasetId)) return false;
        if (excludedSeeds.has(r.seed)) return false;

        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const matchesSearch =
            r.datasetName.toLowerCase().includes(q) ||
            r.modelName.toLowerCase().includes(q) ||
            r.seed.toString().includes(q);
          if (!matchesSearch) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let valA: string | number;
        let valB: string | number;

        if (sortCol === 'modelName' || sortCol === 'datasetName') {
          valA = a[sortCol];
          valB = b[sortCol];
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else if (sortCol === 'seed') {
          valA = a.seed;
          valB = b.seed;
        } else if (sortCol === 'durationSeconds') {
          valA = a.durationSeconds ?? -1;
          valB = b.durationSeconds ?? -1;
        } else {
          valA = a.metrics[sortCol] ?? 0;
          valB = b.metrics[sortCol] ?? 0;
        }

        return sortAsc ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
      });
  }, [rawRecords, excludedModels, excludedDatasets, excludedSeeds, searchTerm, sortCol, sortAsc]);

  const handleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(false);
    }
  };

  const exportCSV = () => {
    const headers = ['Model', 'Dataset', 'Seed', 'Best Epoch', 'Duration (s)', 'ARI', 'NMI', 'AMI', 'Homogeneity', 'V-measure', 'Silhouette', 'CHI', 'DBI'];
    const csvContent = [
      headers.join(','),
      ...filteredRecords.map(r =>
        [
          `"${r.modelName}"`,
          `"${r.datasetName}"`,
          r.seed,
          r.bestEpoch || 0,
          r.durationSeconds !== undefined ? r.durationSeconds.toFixed(2) : '',
          r.metrics['ARI'] ?? '',
          r.metrics['NMI'] ?? '',
          r.metrics['AMI'] ?? '',
          r.metrics['Homogeneity'] ?? '',
          r.metrics['V-measure'] ?? '',
          r.metrics['Silhouette'] ?? '',
          r.metrics['CHI'] ?? '',
          r.metrics['DBI'] ?? '',
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `raw_evaluations_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-6 shadow-sm flex flex-col">
        {/* Top Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-heading font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Table className="w-4 h-4 text-indigo-400" />
              Raw Data Explorer
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Showing <span className="font-semibold text-[var(--text-primary)]">{filteredRecords.length}</span> of{' '}
              <span className="font-semibold text-[var(--text-primary)]">{rawRecords.length}</span> experimental run evaluations
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search model, dataset, seed..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-indigo-500/50 w-52 transition-colors"
              />
            </div>

            {/* Expandable Filter Button */}
            <button
              type="button"
              onClick={() => setIsFilterOpen(prev => !prev)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                isFilterOpen || activeFilterGroupsCount > 0
                  ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-primary)] hover:border-indigo-500/30'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filter</span>
              {activeFilterGroupsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                  {activeFilterGroupsCount}
                </span>
              )}
              {isFilterOpen ? (
                <ChevronUp className="w-3.5 h-3.5 opacity-75" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 opacity-75" />
              )}
            </button>

            {hasAnyFilter && (
              <button
                type="button"
                onClick={resetAllFilters}
                title="Reset all filters"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] hover:border-rose-500/40 text-xs font-semibold text-[var(--text-muted)] hover:text-rose-500 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}

            <button
              type="button"
              onClick={exportCSV}
              disabled={filteredRecords.length === 0}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV ({filteredRecords.length})</span>
            </button>
          </div>
        </div>

        {/* Expandable Checkbox Filter Panel */}
        {isFilterOpen && (
          <div className="mb-6 rounded-2xl bg-[var(--bg-tertiary)]/50 border border-[var(--border-color)] p-4 transition-all">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1. Models Filter Column */}
              <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-3.5 flex flex-col">
                <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-[var(--border-color)]">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                      Models
                    </span>
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">
                      ({selectedModelsCount}/{availableModels.length})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllModels}
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <CheckSquare className="w-3 h-3" />
                      All
                    </button>
                    <span className="text-[var(--text-muted)]">·</span>
                    <button
                      type="button"
                      onClick={deselectAllModels}
                      className="text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Square className="w-3 h-3" />
                      None
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {availableModels.map(m => {
                    const checked = !excludedModels.has(m.id);
                    return (
                      <label
                        key={m.id}
                        className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors select-none ${
                          checked
                            ? 'bg-[var(--bg-tertiary)]/70 text-[var(--text-primary)] font-medium'
                            : 'text-[var(--text-muted)] opacity-60 hover:opacity-90'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleModel(m.id)}
                            className="w-3.5 h-3.5 rounded accent-indigo-600 cursor-pointer shrink-0"
                          />
                          {m.color && (
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: m.color }}
                            />
                          )}
                          <span className="truncate">{m.name}</span>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border-color)] shrink-0">
                          {m.count}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 2. Datasets Filter Column */}
              <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-3.5 flex flex-col">
                <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-[var(--border-color)]">
                  <div className="flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                      Datasets
                    </span>
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">
                      ({selectedDatasetsCount}/{availableDatasets.length})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllDatasets}
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <CheckSquare className="w-3 h-3" />
                      All
                    </button>
                    <span className="text-[var(--text-muted)]">·</span>
                    <button
                      type="button"
                      onClick={deselectAllDatasets}
                      className="text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Square className="w-3 h-3" />
                      None
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {availableDatasets.map(d => {
                    const checked = !excludedDatasets.has(d.id);
                    return (
                      <label
                        key={d.id}
                        className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors select-none ${
                          checked
                            ? 'bg-[var(--bg-tertiary)]/70 text-[var(--text-primary)] font-medium'
                            : 'text-[var(--text-muted)] opacity-60 hover:opacity-90'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleDataset(d.id)}
                            className="w-3.5 h-3.5 rounded accent-indigo-600 cursor-pointer shrink-0"
                          />
                          <span className="truncate" title={d.name}>
                            {d.name}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border-color)] shrink-0">
                          {d.count}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 3. Seeds Filter Column */}
              <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] p-3.5 flex flex-col">
                <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-[var(--border-color)]">
                  <div className="flex items-center gap-2">
                    <Hash className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                      Seeds
                    </span>
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">
                      ({selectedSeedsCount}/{availableSeeds.length})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllSeeds}
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <CheckSquare className="w-3 h-3" />
                      All
                    </button>
                    <span className="text-[var(--text-muted)]">·</span>
                    <button
                      type="button"
                      onClick={deselectAllSeeds}
                      className="text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Square className="w-3 h-3" />
                      None
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {availableSeeds.map(({ seed, count }) => {
                    const checked = !excludedSeeds.has(seed);
                    return (
                      <label
                        key={seed}
                        className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors select-none ${
                          checked
                            ? 'bg-[var(--bg-tertiary)]/70 text-[var(--text-primary)] font-medium'
                            : 'text-[var(--text-muted)] opacity-60 hover:opacity-90'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSeed(seed)}
                            className="w-3.5 h-3.5 rounded accent-indigo-600 cursor-pointer shrink-0"
                          />
                          <span className="font-mono">Seed {seed}</span>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border-color)] shrink-0">
                          {count}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] uppercase font-semibold">
                <th onClick={() => handleSort('modelName')} className="pb-3 cursor-pointer hover:text-[var(--text-primary)]">
                  <div className="flex items-center gap-1">Model <ChevronsUpDown className="w-3 h-3" /></div>
                </th>
                <th onClick={() => handleSort('datasetName')} className="pb-3 cursor-pointer hover:text-[var(--text-primary)]">
                  <div className="flex items-center gap-1">Dataset <ChevronsUpDown className="w-3 h-3" /></div>
                </th>
                <th onClick={() => handleSort('seed')} className="pb-3 cursor-pointer hover:text-[var(--text-primary)]">
                  <div className="flex items-center gap-1">Seed <ChevronsUpDown className="w-3 h-3" /></div>
                </th>
                <th onClick={() => handleSort('ARI')} className="pb-3 cursor-pointer hover:text-[var(--text-primary)]">
                  <div className="flex items-center gap-1">ARI <ChevronsUpDown className="w-3 h-3" /></div>
                </th>
                <th onClick={() => handleSort('NMI')} className="pb-3 cursor-pointer hover:text-[var(--text-primary)]">
                  <div className="flex items-center gap-1">NMI <ChevronsUpDown className="w-3 h-3" /></div>
                </th>
                <th onClick={() => handleSort('AMI')} className="pb-3 cursor-pointer hover:text-[var(--text-primary)]">
                  <div className="flex items-center gap-1">AMI <ChevronsUpDown className="w-3 h-3" /></div>
                </th>
                <th onClick={() => handleSort('Homogeneity')} className="pb-3 cursor-pointer hover:text-[var(--text-primary)]">
                  <div className="flex items-center gap-1">Homogeneity <ChevronsUpDown className="w-3 h-3" /></div>
                </th>
                <th onClick={() => handleSort('V-measure')} className="pb-3 cursor-pointer hover:text-[var(--text-primary)]">
                  <div className="flex items-center gap-1">V-Measure <ChevronsUpDown className="w-3 h-3" /></div>
                </th>
                <th onClick={() => handleSort('Silhouette')} className="pb-3 cursor-pointer hover:text-[var(--text-primary)]">
                  <div className="flex items-center gap-1">Silhouette <ChevronsUpDown className="w-3 h-3" /></div>
                </th>
                <th onClick={() => handleSort('durationSeconds')} className="pb-3 cursor-pointer hover:text-[var(--text-primary)]">
                  <div className="flex items-center gap-1">Duration <ChevronsUpDown className="w-3 h-3" /></div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-[var(--text-muted)]">
                    No evaluation records match the current filter selection.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, idx) => (
                  <tr key={`${r.modelId}-${r.datasetId}-${r.seed}-${idx}`} className="hover:bg-[var(--bg-tertiary)]/30 transition-colors">
                    <td className="py-2.5 font-bold text-[var(--text-primary)]">{r.modelName}</td>
                    <td className="py-2.5 text-[var(--text-secondary)]">{r.datasetName}</td>
                    <td className="py-2.5 font-mono text-[var(--text-muted)]">{r.seed}</td>
                    <td className="py-2.5 font-mono font-semibold text-indigo-400">{r.metrics['ARI']?.toFixed(4)}</td>
                    <td className="py-2.5 font-mono text-[var(--text-secondary)]">{r.metrics['NMI']?.toFixed(4)}</td>
                    <td className="py-2.5 font-mono text-[var(--text-secondary)]">{r.metrics['AMI']?.toFixed(4)}</td>
                    <td className="py-2.5 font-mono text-[var(--text-secondary)]">{r.metrics['Homogeneity']?.toFixed(4)}</td>
                    <td className="py-2.5 font-mono text-[var(--text-secondary)]">{r.metrics['V-measure']?.toFixed(4)}</td>
                    <td className="py-2.5 font-mono font-semibold text-emerald-400">{r.metrics['Silhouette']?.toFixed(4)}</td>
                    <td className="py-2.5 font-mono text-[var(--text-secondary)]">{formatDuration(r.durationSeconds)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

