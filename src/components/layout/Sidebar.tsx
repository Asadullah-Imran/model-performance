'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  LineChart,
  GitCompare,
  Sliders,
  ShieldCheck,
  TrendingUp,
  Image as ImageIcon,
  Table,
  Layers,
  ExternalLink,
  Activity,
  BarChart3,
} from 'lucide-react';
import { useDashboard } from '@/context/DashboardContext';

const NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/overall', label: 'Overall Performance', icon: BarChart3 },
  { href: '/analytics', label: 'Detailed Analytics', icon: LineChart },
  { href: '/comparison', label: 'Head-to-Head', icon: GitCompare },
  { href: '/ablation', label: 'Ablation & Weights', icon: Sliders },
  { href: '/stability', label: 'Statistical Stability', icon: ShieldCheck },
  { href: '/curves', label: 'Training Dynamics', icon: TrendingUp },
  { href: '/visualizations', label: 'Spatial & UMAPs', icon: ImageIcon },
  { href: '/inspector', label: 'Dataset Inspector', icon: Table },
  { href: '/models', label: 'Model Registry', icon: Layers },
];

export function Sidebar() {
  const pathname = usePathname();
  const { models } = useDashboard();

  return (
    <aside className="w-72 bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex flex-col h-screen flex-shrink-0 z-20 transition-all duration-300">
      {/* Sidebar Header */}
      <div className="p-5 flex items-center justify-between border-b border-[var(--border-color)]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/10 dark:bg-indigo-600/20 border border-indigo-500/20 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-md shadow-indigo-500/5">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-lg leading-none bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
              SpatialAnalyzer
            </h2>
            <span className="text-[11px] text-[var(--text-muted)] font-medium">Multi-Omics Research</span>
          </div>
        </div>
        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full uppercase bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
          v2.0
        </span>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
        <div className="px-3 py-1.5 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          Analysis Views
        </div>
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-sm dark:bg-indigo-500/15 dark:text-indigo-400 dark:border-indigo-500/30'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-[var(--text-muted)]'}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Notebook & Colab Links */}
      <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-tertiary)]/40 text-xs">
        <div className="flex items-center justify-between mb-2.5">
          <span className="font-semibold text-[var(--text-muted)] uppercase tracking-wider text-[10px]">
            Model Registry ({models.length})
          </span>
          <span className="text-[10px] text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Live DB
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {models.length === 0 ? (
            <span className="col-span-2 text-[11px] text-[var(--text-muted)] italic">
              No models created yet
            </span>
          ) : (
            models.slice(0, 6).map(model => (
              <a
                key={model.id}
                href={model.colabUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-indigo-500/40 transition-colors"
              >
                <span className="truncate">{model.name}</span>
                <ExternalLink className="w-3 h-3 text-[var(--text-muted)] flex-shrink-0" />
              </a>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
