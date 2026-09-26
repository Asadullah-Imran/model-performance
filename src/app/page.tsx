'use client';

import React from 'react';
import { useDashboard } from '@/context/DashboardContext';
import { ModelSummaryCard } from '@/components/overview/ModelSummaryCard';
import { LeaderboardTable } from '@/components/overview/LeaderboardTable';
import { RadarOverviewChart } from '@/components/overview/RadarOverviewChart';
import { Terminal, Database, UploadCloud } from 'lucide-react';

export default function OverviewPage() {
  const { models, resultsByModel, totalRunsCount, selectedDataset } = useDashboard();

  return (
    <div className="space-y-6">
      {/* Empty State Banner if no experiments have been run or imported yet */}
      {totalRunsCount === 0 && (
        <div className="p-6 rounded-3xl bg-indigo-600/10 border border-indigo-500/30 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 flex-shrink-0">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-[var(--text-primary)]">
                MongoDB Database Connected — Waiting for Experiment Runs
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 max-w-2xl leading-relaxed">
                The database is clean and ready. Run your Python training script or click <strong className="text-indigo-400">Import to DB</strong> in the header to push model results, metrics, and spatial embeddings into the dashboard.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] px-4 py-2.5 rounded-2xl text-xs font-mono text-indigo-300">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>python AriseSpatialGlue_4Encoder_1Layer.py</span>
          </div>
        </div>
      )}

      {/* Model Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {models.map(model => (
          <ModelSummaryCard
            key={model.id}
            model={model}
            results={resultsByModel[model.id]}
          />
        ))}
      </div>

      {/* Leaderboard and Radar Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <LeaderboardTable />
        </div>
        <div className="lg:col-span-5">
          <RadarOverviewChart />
        </div>
      </div>
    </div>
  );
}
