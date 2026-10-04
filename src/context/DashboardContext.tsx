'use client';

import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import {
  ModelMetadata,
  DatasetInfo,
  MetricDefinition,
  ModelDatasetResults,
  RawEvaluationRecord,
} from '@/types';
import { METRIC_REGISTRY, DATASET_REGISTRY, MODEL_REGISTRY } from '@/lib/registry';
import { aggregateExperimentRuns } from '@/lib/data-loader';

interface DashboardContextType {
  // Datasets & Filter state
  datasets: DatasetInfo[];
  selectedDataset: string;
  setSelectedDataset: (id: string) => void;

  // Metrics
  metrics: MetricDefinition[];
  selectedMetric: string;
  setSelectedMetric: (key: string) => void;

  // Models
  models: ModelMetadata[];
  selectedModelId: string;
  setSelectedModelId: (id: string) => void;
  selectedModelIds: string[];
  setSelectedModelIds: (ids: string[]) => void;
  toggleModelFilter: (modelId: string) => void;
  selectAllModels: () => void;
  deselectAllModels: () => void;
  filteredModels: ModelMetadata[];

  // Results & Live Data
  resultsByModel: Record<string, ModelDatasetResults>;
  rawRecords: RawEvaluationRecord[];
  totalRunsCount: number;
  refreshData: () => Promise<void>;

  // Custom Weights for Ablation
  metricWeights: Record<string, number>;
  setMetricWeights: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  updateMetricWeight: (metricKey: string, weight: number) => void;
  resetMetricWeights: () => void;
  equalizeMetricWeights: () => void;

  // Theme
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  // Sidebar Collapse state
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Loading state
  isLoading: boolean;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [selectedDataset, setSelectedDataset] = useState<string>('all');
  const [selectedMetric, setSelectedMetric] = useState<string>('ARI');
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dbRuns, setDbRuns] = useState<any[]>([]);
  const [dbModels, setDbModels] = useState<ModelMetadata[]>([]);

  // Load saved theme and sidebar preferences on initial mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('dashboard_theme') as 'light' | 'dark' | null;
      if (savedTheme === 'dark' || savedTheme === 'light') {
        setTheme(savedTheme);
      } else {
        setTheme('light');
      }

      const savedSidebar = localStorage.getItem('dashboard_sidebar_collapsed');
      if (savedSidebar === 'true') {
        setIsSidebarCollapsed(true);
      }
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('dashboard_sidebar_collapsed', String(next));
      }
      return next;
    });
  }, []);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setIsSidebarCollapsed(collapsed);
    if (typeof window !== 'undefined') {
      localStorage.setItem('dashboard_sidebar_collapsed', String(collapsed));
    }
  }, []);

  // Initial weights
  const initialWeights = useMemo(() => {
    const weights: Record<string, number> = {};
    METRIC_REGISTRY.forEach(m => {
      weights[m.key] = m.defaultWeight;
    });
    return weights;
  }, []);

  const [metricWeights, setMetricWeights] = useState<Record<string, number>>(initialWeights);

  // Fetch real experiment data from MongoDB via /api/experiments
  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/experiments?datasetId=${selectedDataset}`);
      if (res.ok) {
        const json = await res.json();
        setDbRuns(json.runs || []);
        if (json.models) {
          setDbModels(json.models);
          if (json.models.length > 0 && !selectedModelId) {
            setSelectedModelId(json.models[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load experiments from database:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDataset, selectedModelId]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Aggregate only real runs from database
  const aggregatedData = useMemo(() => {
    return aggregateExperimentRuns(dbRuns, dbModels, selectedDataset);
  }, [dbRuns, dbModels, selectedDataset]);

  const updateMetricWeight = (metricKey: string, weight: number) => {
    setMetricWeights(prev => ({
      ...prev,
      [metricKey]: Math.max(0, Math.min(100, weight)),
    }));
  };

  const resetMetricWeights = () => {
    setMetricWeights(initialWeights);
  };

  const equalizeMetricWeights = () => {
    const activeMetrics = METRIC_REGISTRY.filter(m => m.defaultWeight > 0);
    const equalVal = Math.round(100 / (activeMetrics.length || 1));
    const newWeights: Record<string, number> = {};
    METRIC_REGISTRY.forEach(m => {
      newWeights[m.key] = m.defaultWeight > 0 ? equalVal : 0;
    });
    setMetricWeights(newWeights);
  };

  const toggleTheme = () => {
    setTheme(prev => {
      const nextTheme = prev === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') {
        localStorage.setItem('dashboard_theme', nextTheme);
      }
      if (typeof document !== 'undefined') {
        if (nextTheme === 'dark') {
          document.documentElement.classList.add('dark');
          document.documentElement.classList.remove('light');
          document.body.classList.add('dark-theme');
          document.body.classList.remove('light-theme');
        } else {
          document.documentElement.classList.remove('dark');
          document.documentElement.classList.add('light');
          document.body.classList.remove('dark-theme');
          document.body.classList.add('light-theme');
        }
      }
      return nextTheme;
    });
  };

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
      }
    }
  }, [theme]);

  // Keep selectedModelId in sync if empty
  useEffect(() => {
    if (aggregatedData.models.length > 0) {
      if (!selectedModelId || !aggregatedData.models.some(m => m.id === selectedModelId)) {
        setSelectedModelId(aggregatedData.models[0].id);
      }
    }
  }, [aggregatedData.models, selectedModelId]);

  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);

  // When models load, default selectedModelIds to all models if empty
  useEffect(() => {
    if (aggregatedData.models.length > 0) {
      setSelectedModelIds(prev => {
        if (prev.length === 0) {
          return aggregatedData.models.map(m => m.id);
        }
        const valid = prev.filter(id => aggregatedData.models.some(m => m.id === id));
        return valid.length > 0 ? valid : aggregatedData.models.map(m => m.id);
      });
    }
  }, [aggregatedData.models]);

  const toggleModelFilter = useCallback((modelId: string) => {
    setSelectedModelIds(prev => {
      if (prev.includes(modelId)) {
        if (prev.length <= 1) return prev; // Keep at least one model active
        return prev.filter(id => id !== modelId);
      } else {
        return [...prev, modelId];
      }
    });
  }, []);

  const selectAllModels = useCallback(() => {
    setSelectedModelIds(aggregatedData.models.map(m => m.id));
  }, [aggregatedData.models]);

  const deselectAllModels = useCallback(() => {
    if (aggregatedData.models.length > 0) {
      setSelectedModelIds([aggregatedData.models[0].id]);
    }
  }, [aggregatedData.models]);

  const filteredModels = useMemo(() => {
    if (selectedModelIds.length === 0) {
      return aggregatedData.models;
    }
    return aggregatedData.models.filter(m => selectedModelIds.includes(m.id));
  }, [aggregatedData.models, selectedModelIds]);

  const value = {
    datasets: DATASET_REGISTRY,
    selectedDataset,
    setSelectedDataset,
    metrics: METRIC_REGISTRY,
    selectedMetric,
    setSelectedMetric,
    models: aggregatedData.models,
    selectedModelId,
    setSelectedModelId,
    selectedModelIds,
    setSelectedModelIds,
    toggleModelFilter,
    selectAllModels,
    deselectAllModels,
    filteredModels,
    resultsByModel: aggregatedData.resultsByModel,
    rawRecords: aggregatedData.rawRecords,
    totalRunsCount: dbRuns.length,
    refreshData,
    metricWeights,
    setMetricWeights,
    updateMetricWeight,
    resetMetricWeights,
    equalizeMetricWeights,
    theme,
    toggleTheme,
    isSidebarCollapsed,
    toggleSidebar,
    setSidebarCollapsed,
    isLoading,
  };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}
