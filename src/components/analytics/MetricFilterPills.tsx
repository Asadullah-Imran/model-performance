'use client';

import React from 'react';
import { useDashboard } from '@/context/DashboardContext';

export function MetricFilterPills() {
  const { metrics, selectedMetric, setSelectedMetric } = useDashboard();

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-sm">
      <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider px-3">
        Select Metric:
      </span>
      {metrics.map(m => {
        const isSelected = selectedMetric === m.key;
        return (
          <button
            key={m.key}
            onClick={() => setSelectedMetric(m.key)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
              isSelected
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 scale-105'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
            }`}
          >
            {m.name} ({m.shortName})
          </button>
        );
      })}
    </div>
  );
}
