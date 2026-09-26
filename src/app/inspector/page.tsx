'use client';

import React, { useState, useMemo } from 'react';
import { Table, Download, Search, ChevronsUpDown } from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';

type SortColumn = 'modelName' | 'datasetName' | 'seed' | 'ARI' | 'NMI' | 'AMI' | 'Homogeneity' | 'V-measure' | 'Silhouette';

export default function InspectorPage() {
  const { rawRecords, models } = useDashboard();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [modelFilter, setModelFilter] = useState<string>('all');
  const [sortCol, setSortCol] = useState<SortColumn>('ARI');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const filteredRecords = useMemo(() => {
    return rawRecords
      .filter(r => {
        const matchesModel = modelFilter === 'all' || r.modelId === modelFilter;
        const matchesSearch =
          r.datasetName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.modelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.seed.toString().includes(searchTerm);
        return matchesModel && matchesSearch;
      })
      .sort((a, b) => {
        let valA: any;
        let valB: any;

        if (sortCol === 'modelName' || sortCol === 'datasetName') {
          valA = a[sortCol];
          valB = b[sortCol];
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else if (sortCol === 'seed') {
          valA = a.seed;
          valB = b.seed;
        } else {
          valA = a.metrics[sortCol] ?? 0;
          valB = b.metrics[sortCol] ?? 0;
        }

        return sortAsc ? valA - valB : valB - valA;
      });
  }, [rawRecords, modelFilter, searchTerm, sortCol, sortAsc]);

  const handleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(false);
    }
  };

  const exportCSV = () => {
    const headers = ['Model', 'Dataset', 'Seed', 'Best Epoch', 'ARI', 'NMI', 'AMI', 'Homogeneity', 'V-measure', 'Silhouette', 'CHI', 'DBI'];
    const csvContent = [
      headers.join(','),
      ...filteredRecords.map(r =>
        [
          `"${r.modelName}"`,
          `"${r.datasetName}"`,
          r.seed,
          r.bestEpoch || 0,
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-base font-heading font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Table className="w-4 h-4 text-indigo-400" />
              Raw Data Explorer
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Showing {filteredRecords.length} experimental run evaluations across all seeds
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search dataset or seed..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none w-48"
              />
            </div>

            <select
              value={modelFilter}
              onChange={e => setModelFilter(e.target.value)}
              className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs font-semibold rounded-xl px-3 py-1.5 focus:outline-none"
            >
              <option value="all">All Models</option>
              {models.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>

            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Download CSV
            </button>
          </div>
        </div>

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
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {filteredRecords.map((r, idx) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
