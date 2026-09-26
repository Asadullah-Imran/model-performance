'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Database, Moon, Sun, Cpu, Sparkles, UploadCloud } from 'lucide-react';
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
  const { datasets, selectedDataset, setSelectedDataset, theme, toggleTheme, models } = useDashboard();
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);

  const currentMeta = ROUTE_TITLES[pathname] || {
    title: 'Spatial Multi-Omics Dashboard',
    subtitle: 'Benchmark analytics platform for deep learning models',
  };

  return (
    <header className="h-20 bg-[var(--bg-secondary)]/80 backdrop-blur-md border-b border-[var(--border-color)] px-8 flex items-center justify-between z-10 flex-shrink-0">
      {/* Title Area */}
      <div>
        <h1 className="text-xl font-heading font-bold text-[var(--text-primary)] flex items-center gap-2">
          {currentMeta.title}
        </h1>
        <p className="text-xs text-[var(--text-muted)]">{currentMeta.subtitle}</p>
      </div>

      {/* Controls Area */}
      <div className="flex items-center gap-3.5">
        {/* Dataset Selector */}
        <div className="flex items-center gap-2 bg-[var(--bg-tertiary)]/70 border border-[var(--border-color)] px-3 py-1.5 rounded-xl text-xs font-medium text-[var(--text-secondary)] shadow-sm">
          <Database className="w-3.5 h-3.5 text-indigo-400" />
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

        {/* Model Count Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
          <Cpu className="w-3.5 h-3.5" />
          <span>{models.length} Models Active</span>
        </div>

        {/* Upload / Ingest JSON to MongoDB Button */}
        <button
          onClick={() => setIsUploadOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-400 border border-indigo-500/30 text-xs font-semibold transition-all shadow-sm"
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>Import to DB</span>
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle Theme"
          className="p-2.5 rounded-xl bg-[var(--bg-tertiary)]/70 border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-indigo-500/40 transition-all shadow-sm"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
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
