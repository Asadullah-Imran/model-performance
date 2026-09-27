'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Database, Moon, Sun, Cpu, UploadCloud, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';
import { UploadExperimentModal } from '@/components/upload/UploadExperimentModal';

const ROUTE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': {
    title: 'Overview Dashboard',
    subtitle: 'Aggregate multi-metric evaluation and global benchmark leaderboard',
  },
  '/analytics': {
    title: 'Detailed Analytics',
    subtitle: 'Score distributions, multi-seed consistency, and standard error bounds',
  },
  '/comparison': {
    title: 'Head-to-Head Comparison',
    subtitle: 'Paired significance test (p-value), delta matrix, and winner margin analysis',
  },
  '/ablation': {
    title: 'Ablation & Preference Weights',
    subtitle: 'Interactive multi-criteria importance sliders and metric correlation matrix',
  },
  '/stability': {
    title: 'Statistical Stability Analysis',
    subtitle: 'Cross-seed variance, standard deviation (σ), and coefficient of variation (CV%)',
  },
  '/curves': {
    title: 'Training Dynamics & Loss Breakdown',
    subtitle: 'Epoch-by-epoch clustering score trajectories and multi-loss decomposition',
  },
  '/visualizations': {
    title: 'Spatial Multi-Omics & UMAP Explorer',
    subtitle: 'Ground truth vs. predicted spatial domain maps, UMAPs, and violin profiles',
  },
  '/inspector': {
    title: 'Raw Data Explorer',
    subtitle: 'Searchable, sortable evaluation records for every dataset and seed run',
  },
  '/models': {
    title: 'Model Architecture Registry',
    subtitle: 'Hyperparameters, layer specifications, and training configuration parameters',
  },
};

export function Header() {
  const pathname = usePathname();
  const {
    datasets,
    selectedDataset,
    setSelectedDataset,
    theme,
    toggleTheme,
    models,
    isLoading,
    totalRunsCount,
    refreshData,
  } = useDashboard();
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);

  const currentMeta = ROUTE_TITLES[pathname] || {
    title: 'Spatial Multi-Omics Dashboard',
    subtitle: 'Benchmark analytics platform for deep learning models',
  };

  return (
    <header className="relative h-20 bg-[var(--bg-secondary)]/80 backdrop-blur-md border-b border-[var(--border-color)] px-8 flex items-center justify-between z-10 flex-shrink-0">
      {/* Top Animated Loading Glow Bar */}
      {isLoading && (
        <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-pulse z-50 shadow-sm" />
      )}

      {/* Title Area */}
      <div>
        <h1 className="text-xl font-heading font-bold text-[var(--text-primary)] flex items-center gap-2">
          {currentMeta.title}
        </h1>
        <p className="text-xs text-[var(--text-muted)]">{currentMeta.subtitle}</p>
      </div>

      {/* Controls Area */}
      <div className="flex items-center gap-3">
        {/* Dataset Selector */}
        <div className="flex items-center gap-2 bg-[var(--bg-tertiary)]/70 border border-[var(--border-color)] px-3 py-1.5 rounded-xl text-xs font-medium text-[var(--text-secondary)] shadow-sm">
          <Database className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <label htmlFor="dataset-select" className="text-[var(--text-muted)] font-semibold">
            Dataset:
          </label>
          <select
            id="dataset-select"
            value={selectedDataset}
            onChange={e => setSelectedDataset(e.target.value)}
            className="bg-transparent text-[var(--text-primary)] font-semibold focus:outline-none cursor-pointer pr-2"
          >
            <option value="all" className="bg-[var(--bg-secondary)] text-[var(--text-primary)]">
              All Datasets (Combined Benchmark)
            </option>
            {datasets.map(d => (
              <option key={d.id} value={d.id} className="bg-[var(--bg-secondary)] text-[var(--text-primary)]">
                {d.name} ({d.spotsCount} spots)
              </option>
            ))}
          </select>
        </div>

        {/* Live DB / Sync Status Badge with Refresh action */}
        <button
          onClick={() => refreshData()}
          disabled={isLoading}
          title="Click to refresh latest runs from MongoDB"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-sm ${
            isLoading
              ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/30 dark:text-indigo-400 cursor-wait'
              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 dark:border-emerald-500/25 dark:text-emerald-400 cursor-pointer'
          }`}
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
              <span className="hidden sm:inline">Syncing DB...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">{totalRunsCount} Live Runs</span>
              <RefreshCw className="w-3 h-3 text-emerald-600/70 hover:text-emerald-700 dark:text-emerald-400/60 dark:hover:text-emerald-300 ml-0.5" />
            </>
          )}
        </button>

        {/* Model Count Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-400 text-xs font-semibold">
          <Cpu className="w-3.5 h-3.5" />
          <span>{models.length} Models</span>
        </div>

        {/* Upload / Ingest JSON to MongoDB Button */}
        <button
          onClick={() => setIsUploadOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-600/15 dark:hover:bg-indigo-600/25 dark:text-indigo-400 dark:border-indigo-500/30 text-xs font-semibold transition-all shadow-sm"
        >
          <UploadCloud className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span className="hidden sm:inline">Import to DB</span>
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle Theme"
          className="p-2.5 rounded-xl bg-[var(--bg-tertiary)]/70 border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-indigo-500/40 transition-all shadow-sm"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
        </button>
      </div>

      <UploadExperimentModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={() => setIsUploadOpen(false)}
      />
    </header>
  );
}

