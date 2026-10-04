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
  PanelLeftClose,
  PanelLeftOpen,
  ChevronLeft,
  ChevronRight,
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
  const { models, isSidebarCollapsed, toggleSidebar } = useDashboard();

  return (
    <aside
      className={`bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex flex-col h-screen flex-shrink-0 z-30 transition-all duration-300 ease-in-out ${
        isSidebarCollapsed ? 'w-20' : 'w-72'
      }`}
    >
      {/* Sidebar Header */}
      <div
        className={`p-4 border-b border-[var(--border-color)] flex items-center ${
          isSidebarCollapsed ? 'flex-col gap-3 justify-center' : 'justify-between'
        }`}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/10 dark:bg-indigo-600/20 border border-indigo-500/20 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-md shadow-indigo-500/5 shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          {!isSidebarCollapsed && (
            <div className="min-w-0 transition-opacity duration-200">
              <div className="flex items-center gap-1.5">
                <h2 className="font-heading font-bold text-lg leading-none bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent truncate">
                  SpatialAnalyzer
                </h2>
                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full uppercase bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
                  v2.0
                </span>
              </div>
              <span className="text-[11px] text-[var(--text-muted)] font-medium block truncate">
                Multi-Omics Research
              </span>
            </div>
          )}
        </div>

        {/* Toggle Collapse/Expand Button */}
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-indigo-500/40 hover:bg-indigo-500/10 transition-all shrink-0"
          title={isSidebarCollapsed ? 'Expand Sidebar' : 'Minimize Sidebar'}
          aria-label={isSidebarCollapsed ? 'Expand Sidebar' : 'Minimize Sidebar'}
        >
          {isSidebarCollapsed ? (
            <PanelLeftOpen className="w-4 h-4 text-indigo-500" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1.5">
        {!isSidebarCollapsed && (
          <div className="px-3 py-1 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Analysis Views
          </div>
        )}

        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <div key={item.href} className="relative group">
              <Link
                href={item.href}
                className={`flex items-center rounded-xl font-medium text-sm transition-all duration-200 ${
                  isSidebarCollapsed
                    ? 'justify-center w-12 h-12 mx-auto'
                    : 'gap-3.5 px-3.5 py-2.5 w-full'
                } ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-sm dark:bg-indigo-500/15 dark:text-indigo-400 dark:border-indigo-500/30'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                <Icon
                  className={`shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                    isSidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4'
                  } ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-[var(--text-muted)]'}`}
                />
                {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
              </Link>

              {/* Minimized Floating Tooltip on Hover */}
              {isSidebarCollapsed && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-slate-100 text-xs font-semibold shadow-xl border border-slate-700 pointer-events-none whitespace-nowrap opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1 transition-all duration-200 z-50">
                  <span>{item.label}</span>
                  {isActive && <span className="ml-1.5 text-[10px] text-indigo-400 font-bold">• Active</span>}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Notebook & Colab Links / Model Registry Footer */}
      <div className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-tertiary)]/40 text-xs">
        {isSidebarCollapsed ? (
          /* Minimized Model Registry Icon */
          <div className="relative group flex justify-center py-1">
            <Link
              href="/models"
              className="w-12 h-12 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-indigo-500/40 transition-colors"
            >
              <Layers className="w-5 h-5 text-indigo-500" />
            </Link>
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-slate-100 text-xs shadow-xl border border-slate-700 pointer-events-none whitespace-nowrap opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200 z-50 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>Model Registry ({models.length})</span>
              </div>
              <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Live Database Ingestion</span>
              </div>
            </div>
          </div>
        ) : (
          /* Expanded Model Registry Section */
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-[var(--text-muted)] uppercase tracking-wider text-[10px]">
                Model Registry ({models.length})
              </span>
              <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Live DB
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {models.length === 0 ? (
                <span className="col-span-2 text-[11px] text-[var(--text-muted)] italic">
                  No models created yet
                </span>
              ) : (
                models.slice(0, 4).map(model => (
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
        )}
      </div>
    </aside>
  );
}
